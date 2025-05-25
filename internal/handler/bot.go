package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
	var update models.Update
	if err := c.Bind(&update); err != nil {
		log.Printf("Failed to bind update: %v", err)
		return c.NoContent(400)
	}

	if update.Message == nil && update.CallbackQuery == nil {
		return c.NoContent(200)
	}

	resp := h.handleUpdate(update)
	if resp != nil {
		if _, err := h.bot.SendMessage(context.Background(), resp); err != nil {
			log.Printf("Failed to send message: %v", err)
		}
	}

	return c.NoContent(200)
}

func (h *Handler) handleUpdate(update models.Update) (msg *telegram.SendMessageParams) {
	var chatID int64
	var name *string
	var username *string
	if update.Message != nil {
		chatID = update.Message.From.ID
		username = &update.Message.From.Username

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

	if update.Message.Text != "" && update.Message.Text[0] == '/' {
		command := strings.Split(strings.TrimSpace(update.Message.Text[1:]), " ")[0]
		switch command {
		case "start":
			// Send photo with caption instead of just text
			photoParams := &telegram.SendPhotoParams{
				ChatID:    chatID,
				Photo:     &models.InputFileString{Data: "https://assets.peatch.io/isometric-icon-A-delicious-layered--by-bnbicons.com.png"},
				Caption:   "Привет\\! Я \\- *Вэлли\\-Вонка*, и ты только что попал на шоколадную фабрику здоровья\\.\n\nОтслеживай своё питание с помощью этого бота\\.\n\nОтправь мне фото еды, и я помогу тебе узнать её калорийность и состав\\. Также ты можешь воспользоваться приложением\\.",
				ParseMode: models.ParseModeMarkdown,
			}

			webAppInfo := &models.WebAppInfo{
				URL: h.config.WebAppURL,
			}
			replyMarkup := &models.InlineKeyboardMarkup{
				InlineKeyboard: [][]models.InlineKeyboardButton{
					{
						{
							Text:   "Открыть в приложении",
							WebApp: webAppInfo,
						},
					},
				},
			}
			photoParams.ReplyMarkup = replyMarkup

			// Send photo message
			if _, err := h.bot.SendPhoto(context.Background(), photoParams); err != nil {
				log.Printf("Failed to send photo: %v", err)
				// Fallback to text message if photo fails
				msg.Text = "Привет\\! Я \\- *Вэлли\\-Вонка*, и ты только что попал на шоколадную фабрику здоровья\\.\n\nОтслеживай своё питание с помощью этого бота\\.\n\nОтправь мне фото еды, и я помогу тебе узнать её калорийность и состав\\. Также ты можешь воспользоваться приложением\\."
				msg.ParseMode = models.ParseModeMarkdown
				msg.ReplyMarkup = replyMarkup
			} else {
				// Return nil since we already sent the photo
				return nil
			}
		case "help":
			msg.Text = "TODO: Справка по командам\\!"
			msg.ParseMode = models.ParseModeMarkdown
		case "test":
			webAppInfo := &models.WebAppInfo{
				URL: "https://127.0.0.1:3000",
			}
			replyMarkup := &models.InlineKeyboardMarkup{
				InlineKeyboard: [][]models.InlineKeyboardButton{
					{
						{
							Text:   "Test WebApp",
							WebApp: webAppInfo,
						},
					},
				},
			}
			msg.Text = "for local dev"
			msg.ReplyMarkup = replyMarkup
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

func (h *Handler) processPhotoMessage(update models.Update, user *db.User) *telegram.SendMessageParams {
	ctx := context.Background()
	chatID := update.Message.From.ID

	// Send analyzing message immediately
	params := &telegram.SendMessageParams{
		ChatID: chatID,
		Text:   "🔍 Analyzing your food image... This may take a moment.",
	}

	sentMsg, err := h.bot.SendMessage(ctx, params)

	var analyzingMessageID int
	if err == nil && sentMsg != nil {
		analyzingMessageID = sentMsg.ID
	}

	go func() {
		if err := h.processFoodImage(ctx, update, user, analyzingMessageID); err != nil {
			log.Printf("Failed to process food image: %v", err)

			// Delete the analyzing message before sending error
			if analyzingMessageID != 0 {
				del := &telegram.DeleteMessageParams{
					ChatID:    chatID,
					MessageID: analyzingMessageID,
				}
				_, _ = h.bot.DeleteMessage(ctx, del)
			}

			// Get user-friendly error message
			errorMessage := GetUserFriendlyMessage(err)

			params = &telegram.SendMessageParams{
				ChatID: chatID,
				Text:   errorMessage,
			}

			_, _ = h.bot.SendMessage(ctx, params)
		}
	}()

	// Return nil since we already sent the message
	return nil
}

func (h *Handler) processFoodImage(ctx context.Context, update models.Update, user *db.User, analyzingMessageID int) error {
	chatID := update.Message.From.ID

	// Get the highest resolution photo
	photos := update.Message.Photo
	if len(photos) == 0 {
		return ErrNoPhotoFound
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
		return newProcessingError(ErrStorageUploadFailed, "failed to upload to storage", err)
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

	if analyzingMessageID != 0 {
		del := &telegram.DeleteMessageParams{
			ChatID:    chatID,
			MessageID: analyzingMessageID,
		}
		_, _ = h.bot.DeleteMessage(ctx, del)
	}

	// Send result message
	resultMessage := fmt.Sprintf(`✅ Food analysis complete!

🍽 %s

📊 Nutritional Information:
• Calories: %.0f kcal
• Protein: %.1f g
• Carbs: %.1f g
• Fat: %.1f g`,
		formatFoodNames(result.FoodNames),
		result.TotalCalories,
		result.TotalProteins,
		result.TotalCarbs,
		result.TotalFats)

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

func (h *Handler) fetchAndUploadUserAvatar(ctx context.Context, userID int64) (*string, error) {
	photos, err := h.bot.GetUserProfilePhotos(ctx, &telegram.GetUserProfilePhotosParams{
		UserID: userID,
		Limit:  1,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get user profile photos: %w", err)
	}

	if photos.TotalCount == 0 || len(photos.Photos) == 0 || len(photos.Photos[0]) == 0 {
		return nil, fmt.Errorf("no profile photos found")
	}

	// Get the largest photo
	var largestPhoto *models.PhotoSize
	maxSize := 0
	for _, photo := range photos.Photos[0] {
		size := photo.Width * photo.Height
		if size > maxSize {
			maxSize = size
			largestPhoto = &photo
		}
	}

	if largestPhoto == nil {
		return nil, fmt.Errorf("no suitable photo found")
	}

	// Get file info
	file, err := h.bot.GetFile(ctx, &telegram.GetFileParams{
		FileID: largestPhoto.FileID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get file: %w", err)
	}

	// Download the file
	fileURL := fmt.Sprintf("https://api.telegram.org/file/bot%s/%s", h.config.BotToken, file.FilePath)
	resp, err := http.Get(fileURL)
	if err != nil {
		return nil, fmt.Errorf("failed to download file: %w", err)
	}
	defer resp.Body.Close()

	// Read file content
	fileData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read file data: %w", err)
	}

	// Generate filename
	fileName := fmt.Sprintf("avatars/telegram_%d.jpg", userID)

	// Upload to S3
	_, err = h.storageProvider.UploadFile(ctx, bytes.NewReader(fileData), fileName, "image/jpeg")
	if err != nil {
		return nil, fmt.Errorf("failed to upload to S3: %w", err)
	}

	return &fileName, nil
}

func (h *Handler) setMenuButton(chatID int64) {
	ctx := context.Background()

	menu := telegram.SetChatMenuButtonParams{
		ChatID: chatID,
		MenuButton: models.MenuButtonWebApp{
			Type:   "web_app",
			Text:   "Open App",
			WebApp: models.WebAppInfo{URL: h.config.WebAppURL},
		},
	}

	if _, err := h.bot.SetChatMenuButton(ctx, &menu); err != nil {
		fmt.Printf("failed to set menu button: %v\n", err)
		return
	}

	fmt.Printf("menu button set successfully for chat %d\n", chatID)
}
