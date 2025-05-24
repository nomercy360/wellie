package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	telegram "github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
	"github.com/labstack/echo/v4"
	nanoid "github.com/matoous/go-nanoid/v2"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"
	"wellie/internal/db"
)

func (h *Handler) HandleWebhook(c echo.Context) error {
	var update tgbotapi.Update
	if err := c.Bind(&update); err != nil {
		log.Printf("Failed to bind update: %v", err)
		return c.NoContent(400)
	}

	if update.Message == nil && update.CallbackQuery == nil {
		return c.NoContent(200)
	}

	resp := h.handleUpdate(update)
	if _, err := h.bot.SendMessage(context.Background(), resp); err != nil {
		log.Printf("Failed to send message: %v", err)
	}

	return c.NoContent(200)
}

func (h *Handler) handleUpdate(update tgbotapi.Update) (msg *telegram.SendMessageParams) {
	var chatID int64
	var name *string
	var username *string
	if update.Message != nil {
		chatID = update.Message.From.ID
		username = &update.Message.From.UserName

		name = &update.Message.From.FirstName
		if update.Message.From.FirstName != "" {
			name = &update.Message.From.FirstName
			if update.Message.From.LastName != "" {
				nameWithLast := fmt.Sprintf("%s %s", update.Message.From.FirstName, update.Message.From.LastName)
				name = &nameWithLast
			}
		}
	}

	if username == nil {
		usernameFromID := fmt.Sprintf("user_%d", chatID)
		username = &usernameFromID
	}

	user, err := h.db.GetUser(chatID)

	msg = &telegram.SendMessageParams{
		ChatID: chatID,
	}

	if err != nil && errors.Is(err, db.ErrNotFound) {
		imgUrl := fmt.Sprintf("%s/avatars/%d.svg", "https://assets.peatch.io", rand.Intn(30)+1)

		newUser := &db.User{
			ID:         nanoid.Must(),
			TelegramID: chatID,
			Username:   username,
			Name:       name,
			AvatarURL:  &imgUrl,
		}

		if err := h.db.SaveUser(newUser); err != nil {
			log.Printf("Failed to save user: %v", err)
			msg.Text = "Ошибка при регистрации пользователя. Попробуй позже."
		} else {
			msg.Text = "Добро пожаловать! Используй /start для начала работы с ботом."
		}

		user, err = h.db.GetUser(chatID)
		if err != nil {
			log.Printf("Failed to get user after saving: %v", err)
			msg.Text = "Ошибка при получении пользователя. Попробуй позже."
		}
	} else if err != nil {
		log.Printf("Failed to get user: %v", err)
		msg.Text = "Ошибка при получении пользователя. Попробуй позже."
	} else if user.AvatarURL == nil {
		imgUrl := fmt.Sprintf("%s/avatars/%d.svg", "https://assets.peatch.io", rand.Intn(30)+1)

		newUser := &db.User{
			TelegramID: chatID,
			Username:   username,
			Name:       name,
			AvatarURL:  &imgUrl,
		}

		if err := h.db.UpdateUser(newUser); err != nil {
			log.Printf("Failed to update user: %v", err)
		}
	}

	if update.Message == nil || user == nil {
		return msg
	}

	if update.Message.IsCommand() {
		switch update.Message.Command() {
		case "start":
			msg.Text = "Привет\\!"
			msg.ParseMode = models.ParseModeMarkdown
		case "help":
			msg.Text = "TODO: Справка по командам\\!"
			msg.ParseMode = models.ParseModeMarkdown
		default:
			msg.Text = "Неизвестная команда. Используй /help для получения справки."
		}
		return msg
	}

	// Check if message contains a photo
	if len(update.Message.Photo) > 0 {
		return h.processPhotoMessage(update, user)
	}

	if msg.Text == "" {
		msg.Text = "Send me a photo of your food to track nutrition!"
	}

	return msg
}

func (h *Handler) processPhotoMessage(update tgbotapi.Update, user *db.User) *telegram.SendMessageParams {
	ctx := context.Background()
	chatID := update.Message.From.ID

	msg := &telegram.SendMessageParams{
		ChatID: chatID,
		Text:   "🔍 Analyzing your food image... This may take a moment.",
	}

	// Process asynchronously
	go func() {
		if err := h.processFoodImage(ctx, update, user); err != nil {
			log.Printf("Failed to process food image: %v", err)

			// Provide user-friendly error messages
			errorMessage := "❌ Sorry, I couldn't analyze your food image."

			if err.Error() == "AI service is not configured" {
				errorMessage += " The AI service is temporarily unavailable."
			} else if err.Error() == "no photo found" {
				errorMessage += " Please send a photo."
			} else if strings.Contains(err.Error(), "failed to upload to storage") {
				errorMessage += " There was an issue saving your image."
			} else if strings.Contains(err.Error(), "failed to detect dishes") || strings.Contains(err.Error(), "failed to analyze nutrition") {
				errorMessage += " Please try with a clearer photo of the food."
			} else {
				errorMessage += " Please try again later."
			}

			_, _ = h.bot.SendMessage(ctx, &telegram.SendMessageParams{
				ChatID: chatID,
				Text:   errorMessage,
			})
		}
	}()

	return msg
}

func (h *Handler) processFoodImage(ctx context.Context, update tgbotapi.Update, user *db.User) error {
	chatID := update.Message.From.ID

	// Get the highest resolution photo
	photos := update.Message.Photo
	if len(photos) == 0 {
		return fmt.Errorf("no photo found")
	}

	photo := photos[len(photos)-1]

	// Download photo URL
	fileURL := fmt.Sprintf("https://api.telegram.org/bot%s/getFile?file_id=%s", h.config.BotToken, photo.FileID)
	resp, err := http.Get(fileURL)
	if err != nil {
		return fmt.Errorf("failed to get file info: %w", err)
	}
	defer resp.Body.Close()

	var fileResp struct {
		Ok     bool `json:"ok"`
		Result struct {
			FilePath string `json:"file_path"`
		} `json:"result"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&fileResp); err != nil {
		return fmt.Errorf("failed to decode file response: %w", err)
	}

	if !fileResp.Ok {
		return fmt.Errorf("failed to get file path")
	}

	// Download the actual file
	fileDownloadURL := fmt.Sprintf("https://api.telegram.org/file/bot%s/%s", h.config.BotToken, fileResp.Result.FilePath)
	imageResp, err := http.Get(fileDownloadURL)
	if err != nil {
		return fmt.Errorf("failed to download image: %w", err)
	}
	defer imageResp.Body.Close()

	imageData, err := io.ReadAll(imageResp.Body)
	if err != nil {
		return fmt.Errorf("failed to read image data: %w", err)
	}

	// Upload to S3
	filename := fmt.Sprintf("food-images/%s-%s.jpg", nanoid.Must(), time.Now().Format("20060102"))
	s3URL, err := h.storageProvider.UploadFile(ctx, bytes.NewReader(imageData), filename, "image/jpeg")
	if err != nil {
		return fmt.Errorf("failed to upload to storage: %w", err)
	}

	// Load prompt templates
	dishDetectionPrompt, err := os.ReadFile("templates/prompts/dish_detection.json")
	if err != nil {
		return fmt.Errorf("failed to load dish detection prompt: %w", err)
	}

	dishNutritionPrompt, err := os.ReadFile("templates/prompts/dish_nutrition.json")
	if err != nil {
		return fmt.Errorf("failed to load nutrition prompt: %w", err)
	}

	// Process the food image using shared logic
	result, err := h.processFoodImageCommon(ctx, user.ID, s3URL, dishDetectionPrompt, dishNutritionPrompt)
	if err != nil {
		return fmt.Errorf("failed to process food image: %w", err)
	}

	// Send result message
	resultMessage := fmt.Sprintf(`✅ Food analysis complete!

🍽 Detected: %s

📊 Nutritional Information:
• Calories: %.0f kcal
• Protein: %.1f g
• Carbs: %.1f g
• Fat: %.1f g

✨ Confidence: %.0f%%

Your food has been logged successfully!`,
		formatFoodNames(result.FoodNames),
		result.TotalCalories,
		result.TotalProteins,
		result.TotalCarbs,
		result.TotalFats,
		result.Confidence*100)

	_, err = h.bot.SendMessage(ctx, &telegram.SendMessageParams{
		ChatID: chatID,
		Text:   resultMessage,
	})

	return err
}

func getMealType(t time.Time) string {
	hour := t.Hour()
	switch {
	case hour >= 5 && hour < 11:
		return "breakfast"
	case hour >= 11 && hour < 15:
		return "lunch"
	case hour >= 15 && hour < 18:
		return "snack"
	default:
		return "dinner"
	}
}

func formatFoodNames(names []string) string {
	if len(names) == 0 {
		return "Unknown food"
	}
	if len(names) == 1 {
		return names[0]
	}
	if len(names) == 2 {
		return names[0] + " and " + names[1]
	}
	return names[0] + ", " + names[1] + fmt.Sprintf(" and %d more", len(names)-2)
}
