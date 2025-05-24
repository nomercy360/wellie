package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	nanoid "github.com/matoous/go-nanoid/v2"
	"wellie/internal/db"
)

// FoodLogSummary represents a simplified food log entry for the list view
type FoodLogSummary struct {
	ID         string    `json:"id"`
	FoodItemID string    `json:"food_item_id"`
	Name       string    `json:"name"`
	Calories   int       `json:"calories"`
	LogTime    time.Time `json:"log_time"`
	ImageURL   *string   `json:"image_url,omitempty"`
}

// DailyFoodLogs represents food logs grouped by day
type DailyFoodLogs struct {
	Date          string           `json:"date"`
	TotalCalories int              `json:"total_calories"`
	Logs          []FoodLogSummary `json:"logs"`
}

// FoodDetailResponse represents detailed food information
type FoodDetailResponse struct {
	ID             string                 `json:"id"`
	Name           string                 `json:"name"`
	Description    string                 `json:"description,omitempty"`
	Calories       int                    `json:"calories"`
	ImageURL       *string                `json:"image_url,omitempty"`
	Tags           []string               `json:"tags,omitempty"`
	Macronutrients db.Macronutrients      `json:"macronutrients"`
	Micronutrients map[string]interface{} `json:"micronutrients,omitempty"`
	Ingredients    []db.IngredientInfo    `json:"ingredients,omitempty"`
	CookingTime    string                 `json:"cooking_time,omitempty"`
}

// GetUserFoodLogs returns food logs for the last 7 days
// @Summary Get user food logs
// @Description Get food logs for the authenticated user for the last 7 days
// @Tags food
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {array} DailyFoodLogs
// @Failure 401 {object} echo.HTTPError
// @Failure 500 {object} echo.HTTPError
// @Router /v1/food-logs [get]
func (h *Handler) GetUserFoodLogs(c echo.Context) error {
	userID, err := GetUserIDFromToken(c)
	if err != nil {
		return err
	}

	ctx := context.Background()

	// Get logs for the last 7 days
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -7)

	// Create a map to group logs by date
	logsMap := make(map[string]*DailyFoodLogs)

	// Initialize map with all 7 days
	for i := 0; i < 7; i++ {
		date := endDate.AddDate(0, 0, -i)
		dateStr := date.Format("2006-01-02")
		logsMap[dateStr] = &DailyFoodLogs{
			Date:          dateStr,
			TotalCalories: 0,
			Logs:          []FoodLogSummary{},
		}
	}

	// Get logs for each day
	for date := startDate; !date.After(endDate); date = date.AddDate(0, 0, 1) {
		logs, err := h.db.GetUserFoodLogs(ctx, userID, date)
		if err != nil {
			continue
		}

		dateStr := date.Format("2006-01-02")
		dailyLog := logsMap[dateStr]

		for _, log := range logs {
			// Get food item details
			foodItem, err := h.db.GetFoodItemByID(ctx, log.FoodItemID)
			if err != nil {
				continue
			}

			// Calculate calories based on quantity
			calories := int(float64(foodItem.Calories) * (log.Quantity / 100.0))
			dailyLog.TotalCalories += calories

			dailyLog.Logs = append(dailyLog.Logs, FoodLogSummary{
				ID:         log.ID,
				FoodItemID: log.FoodItemID,
				Name:       foodItem.Name,
				Calories:   calories,
				LogTime:    log.LogDate,
				ImageURL:   log.ImageURL,
			})
		}
	}

	// Convert map to slice, sorted by date (newest first)
	var result []DailyFoodLogs
	for i := 0; i < 7; i++ {
		date := endDate.AddDate(0, 0, -i)
		dateStr := date.Format("2006-01-02")
		if dailyLog, exists := logsMap[dateStr]; exists {
			result = append(result, *dailyLog)
		}
	}

	return c.JSON(http.StatusOK, result)
}

// GetFoodDetail returns detailed information about a specific food item
// @Summary Get food item details
// @Description Get detailed information about a specific food item
// @Tags food
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Food item ID"
// @Success 200 {object} FoodDetailResponse
// @Failure 400 {object} echo.HTTPError
// @Failure 404 {object} echo.HTTPError
// @Failure 500 {object} echo.HTTPError
// @Router /v1/food/{id} [get]
func (h *Handler) GetFoodDetail(c echo.Context) error {
	foodID := c.Param("id")
	if foodID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Food ID is required")
	}

	ctx := context.Background()

	// Get food item details
	foodItem, err := h.db.GetFoodItemByID(ctx, foodID)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			return echo.NewHTTPError(http.StatusNotFound, "Food item not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get food item")
	}

	// Parse macronutrients
	var macros db.Macronutrients
	if err := json.Unmarshal(foodItem.Macronutrients, &macros); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to parse macronutrients")
	}

	// Parse micronutrients
	var micros map[string]interface{}
	if foodItem.Micronutrients != nil {
		if err := json.Unmarshal(foodItem.Micronutrients, &micros); err != nil {
			// Log error but don't fail the request
			micros = nil
		}
	}

	// Parse ingredients
	var ingredients []db.IngredientInfo
	if foodItem.Ingredients != nil {
		if err := json.Unmarshal(foodItem.Ingredients, &ingredients); err != nil {
			// Log error but don't fail the request
			ingredients = nil
		}
	}

	// Get the most recent food log for this item to get the image URL
	// This is a simplified approach - you might want to store images differently
	var imageURL *string
	if logs, err := h.db.GetFoodLogsByFoodItemID(ctx, foodID); err == nil && len(logs) > 0 {
		imageURL = logs[0].ImageURL
	}

	// Determine tags based on ingredients and macros
	tags := determineFoodTags(macros, ingredients)

	// Generate description
	description := generateFoodDescription(foodItem.Name, ingredients)

	// Estimate cooking time based on ingredients
	cookingTime := estimateCookingTime(ingredients)

	response := FoodDetailResponse{
		ID:             foodItem.ID,
		Name:           foodItem.Name,
		Description:    description,
		Calories:       foodItem.Calories,
		ImageURL:       imageURL,
		Tags:           tags,
		Macronutrients: macros,
		Micronutrients: micros,
		Ingredients:    ingredients,
		CookingTime:    cookingTime,
	}

	return c.JSON(http.StatusOK, response)
}

// Helper functions

func determineFoodTags(macros db.Macronutrients, ingredients []db.IngredientInfo) []string {
	tags := []string{}

	// Check if high protein
	if macros.Proteins > 20 {
		tags = append(tags, "PROTEIN")
	}

	// Check if vegetarian/vegan
	isVegetarian := true
	for _, ing := range ingredients {
		if ing.Type == "meat" || ing.Type == "seafood" {
			isVegetarian = false
			break
		}
	}
	if isVegetarian {
		tags = append(tags, "VEGETARIAN")
	}

	// Check if easy (few ingredients)
	if len(ingredients) <= 5 {
		tags = append(tags, "EASY")
	}

	return tags
}

func generateFoodDescription(name string, ingredients []db.IngredientInfo) string {
	if len(ingredients) == 0 {
		return "A delicious meal"
	}

	// Create a simple description based on main ingredients
	var mainIngredients []string
	for i, ing := range ingredients {
		if i < 3 { // Take first 3 ingredients
			mainIngredients = append(mainIngredients, ing.Name)
		}
	}

	return fmt.Sprintf("A flavorful meal with %s—simple, tasty, and satisfying.",
		strings.Join(mainIngredients, ", "))
}

func estimateCookingTime(ingredients []db.IngredientInfo) string {
	// Simple estimation based on ingredient types and states
	maxTime := 5

	for _, ing := range ingredients {
		switch ing.State {
		case "baked", "roasted":
			if maxTime < 30 {
				maxTime = 30
			}
		case "grilled", "fried":
			if maxTime < 15 {
				maxTime = 15
			}
		case "boiled", "steamed":
			if maxTime < 20 {
				maxTime = 20
			}
		}
	}

	return fmt.Sprintf("%d min", maxTime)
}

// FoodRecognitionResponse represents the response for food recognition
type FoodRecognitionResponse struct {
	FoodLogs []FoodLogDetail    `json:"food_logs"`
	Summary  RecognitionSummary `json:"summary"`
}

type FoodLogDetail struct {
	ID             string              `json:"id"`
	FoodItemID     string              `json:"food_item_id"`
	Name           string              `json:"name"`
	Quantity       float64             `json:"quantity"`
	Calories       int                 `json:"calories"`
	ImageURL       string              `json:"image_url"`
	MealType       string              `json:"meal_type"`
	LogDate        time.Time           `json:"log_date"`
	Macronutrients db.Macronutrients   `json:"macronutrients"`
	Ingredients    []db.IngredientInfo `json:"ingredients,omitempty"`
}

type RecognitionSummary struct {
	TotalCalories float64 `json:"total_calories"`
	TotalProteins float64 `json:"total_proteins"`
	TotalCarbs    float64 `json:"total_carbs"`
	TotalFats     float64 `json:"total_fats"`
	Confidence    float64 `json:"confidence"`
	ItemsDetected int     `json:"items_detected"`
}

// RecognizeFood handles synchronous food image recognition
// @Summary Recognize food from image
// @Description Upload a food image and get nutritional information
// @Tags food
// @Accept multipart/form-data
// @Produce json
// @Security BearerAuth
// @Param image formData file true "Food image"
// @Success 200 {object} FoodRecognitionResponse
// @Failure 400 {object} echo.HTTPError
// @Failure 401 {object} echo.HTTPError
// @Failure 500 {object} echo.HTTPError
// @Router /v1/food/recognize [post]
func (h *Handler) RecognizeFood(c echo.Context) error {
	userID, err := GetUserIDFromToken(c)
	if err != nil {
		return err
	}

	ctx := context.Background()

	// Get user info
	user, err := h.db.GetUserByID(userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get user info")
	}

	// Parse multipart form
	file, err := c.FormFile("image")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Image file is required")
	}

	// Open the file
	src, err := file.Open()
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Failed to open image file")
	}
	defer src.Close()

	// Read file data
	imageData, err := io.ReadAll(src)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Failed to read image data")
	}

	// Upload to S3
	filename := fmt.Sprintf("food-images/%s-%s.jpg", nanoid.Must(), time.Now().Format("20060102"))
	s3URL, err := h.storageProvider.UploadFile(ctx, bytes.NewReader(imageData), filename, "image/jpeg")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upload image")
	}

	// Load prompt templates
	dishDetectionPrompt, err := os.ReadFile("templates/prompts/dish_detection.json")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to load AI prompts")
	}

	dishNutritionPrompt, err := os.ReadFile("templates/prompts/dish_nutrition.json")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to load AI prompts")
	}

	// Process the food image using shared logic
	result, err := h.processFoodImageCommon(ctx, user.ID, s3URL, dishDetectionPrompt, dishNutritionPrompt)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to analyze image")
	}

	// Convert to API response format
	var foodLogs []FoodLogDetail
	for _, processed := range result.ProcessedFoods {
		foodLogs = append(foodLogs, FoodLogDetail{
			ID:             processed.FoodLog.ID,
			FoodItemID:     processed.FoodItem.ID,
			Name:           processed.FoodItem.Name,
			Quantity:       processed.Quantity,
			Calories:       int(processed.Calories),
			ImageURL:       s3URL,
			MealType:       processed.FoodLog.MealType,
			LogDate:        processed.FoodLog.LogDate,
			Macronutrients: processed.Macronutrients,
			Ingredients:    processed.Ingredients,
		})
	}

	response := FoodRecognitionResponse{
		FoodLogs: foodLogs,
		Summary: RecognitionSummary{
			TotalCalories: result.TotalCalories,
			TotalProteins: result.TotalProteins,
			TotalCarbs:    result.TotalCarbs,
			TotalFats:     result.TotalFats,
			Confidence:    result.Confidence * 100,
			ItemsDetected: len(foodLogs),
		},
	}

	return c.JSON(http.StatusOK, response)
}
