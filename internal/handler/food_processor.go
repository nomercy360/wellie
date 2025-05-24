package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	nanoid "github.com/matoous/go-nanoid/v2"
	"wellie/internal/ai"
	"wellie/internal/db"
)

// ProcessedFood represents the result of processing a single food item
type ProcessedFood struct {
	FoodItem       *db.FoodItem
	FoodLog        *db.FoodLog
	Macronutrients db.Macronutrients
	Ingredients    []db.IngredientInfo
	Quantity       float64
	Calories       float64
}

// FoodProcessingResult represents the complete result of food image processing
type FoodProcessingResult struct {
	ProcessedFoods []ProcessedFood
	TotalCalories  float64
	TotalProteins  float64
	TotalFats      float64
	TotalCarbs     float64
	Confidence     float64
	FoodNames      []string
}

// processFoodImage handles the common logic for processing food images
func (h *Handler) processFoodImageCommon(
	ctx context.Context,
	userID string,
	imageURL string,
	dishDetectionPrompt []byte,
	dishNutritionPrompt []byte,
) (*FoodProcessingResult, error) {
	// Check if AI service is available
	if h.aiService == nil {
		return nil, fmt.Errorf("AI service is not configured")
	}

	// Detect dishes
	dishDetection, err := h.aiService.DetectDish(ctx, imageURL, dishDetectionPrompt)
	if err != nil {
		return nil, fmt.Errorf("failed to analyze image: %w", err)
	}

	// Process detected dishes
	result := &FoodProcessingResult{
		ProcessedFoods: make([]ProcessedFood, 0),
		Confidence:     dishDetection.OverallConfidence,
	}

	for _, dish := range dishDetection.DetectedDishes {
		// Prepare dish description for nutrition analysis
		dishDescription := prepareDishDescription(dish, dishDetection)

		// Analyze nutrition
		nutrition, err := h.aiService.AnalyzeNutrition(ctx, dishDescription, dishNutritionPrompt)
		if err != nil {
			continue
		}

		// Check if food item exists
		foodItem, err := h.db.GetFoodItemByName(ctx, nutrition.Name)
		if errors.Is(err, db.ErrNotFound) {
			// Create new food item
			foodItem, err = createFoodItem(nutrition, dish)
			if err != nil {
				continue
			}

			if err := h.db.CreateFoodItem(ctx, foodItem); err != nil {
				continue
			}
		} else if err != nil {
			continue
		}

		// Calculate quantity
		quantity := calculateQuantity(dish.Ingredients)

		// Create food log
		foodLog := &db.FoodLog{
			ID:         nanoid.Must(),
			UserID:     userID,
			FoodItemID: foodItem.ID,
			Quantity:   quantity,
			MealType:   getMealType(time.Now()),
			ImageURL:   &imageURL,
			LogDate:    time.Now(),
		}

		if err := h.db.CreateFoodLog(ctx, foodLog); err != nil {
			continue
		}

		// Calculate nutritional values
		factor := quantity / 100.0
		calories := float64(foodItem.Calories) * factor

		// Parse macronutrients
		var macros db.Macronutrients
		if err := json.Unmarshal(foodItem.Macronutrients, &macros); err == nil {
			result.TotalProteins += macros.Proteins * factor
			result.TotalFats += macros.Fats * factor
			result.TotalCarbs += macros.Carbs * factor
		}

		// Parse ingredients
		var ingredients []db.IngredientInfo
		if foodItem.Ingredients != nil {
			_ = json.Unmarshal(foodItem.Ingredients, &ingredients)
		}

		result.TotalCalories += calories
		result.FoodNames = append(result.FoodNames, nutrition.Name)
		result.ProcessedFoods = append(result.ProcessedFoods, ProcessedFood{
			FoodItem:       foodItem,
			FoodLog:        foodLog,
			Macronutrients: macros,
			Ingredients:    ingredients,
			Quantity:       quantity,
			Calories:       calories,
		})
	}

	return result, nil
}

// prepareDishDescription creates an escaped text description for AI nutrition analysis
func prepareDishDescription(dish ai.DetectedDish, detection *ai.DishDetectionResponse) string {
	var dishDescriptionText strings.Builder

	dishDescriptionText.WriteString(fmt.Sprintf("Dish: %s (confidence: %.1f%%)\n",
		dish.DishName.Value, dish.DishName.Confidence*100))

	dishDescriptionText.WriteString("\nIngredients:\n")
	for _, ing := range dish.Ingredients {
		dishDescriptionText.WriteString(fmt.Sprintf("- %s: %.1f %s (%s, %s)\n",
			ing.Name, ing.QuantityEstimation.Value, ing.QuantityEstimation.Unit,
			ing.Type, ing.State))
	}

	dishDescriptionText.WriteString(fmt.Sprintf("\nPreparation method: %s\n",
		dish.PreparationMethodGuess))

	if len(dish.PotentialHiddenIngredients) > 0 {
		dishDescriptionText.WriteString("\nPotential hidden ingredients: ")
		dishDescriptionText.WriteString(strings.Join(dish.PotentialHiddenIngredients, ", "))
		dishDescriptionText.WriteString("\n")
	}

	dishDescriptionText.WriteString(fmt.Sprintf("\nOverall confidence: %.1f%%\n",
		detection.OverallConfidence*100))
	dishDescriptionText.WriteString(fmt.Sprintf("Image quality - Clarity: %s, Lighting: %s, Obstructions: %s\n",
		detection.ImageAssessment.Clarity,
		detection.ImageAssessment.Lighting,
		detection.ImageAssessment.Obstructions))

	// Escape text for JSON
	escaped := strings.ReplaceAll(dishDescriptionText.String(), "\\", "\\\\")
	escaped = strings.ReplaceAll(escaped, "\"", "\\\"")
	escaped = strings.ReplaceAll(escaped, "\n", "\\n")
	escaped = strings.ReplaceAll(escaped, "\r", "\\r")
	escaped = strings.ReplaceAll(escaped, "\t", "\\t")

	return escaped
}

// createFoodItem creates a new food item from nutrition data and ingredients
func createFoodItem(nutrition *ai.DishNutritionResponse, dish ai.DetectedDish) (*db.FoodItem, error) {
	macros := db.Macronutrients{
		Proteins: nutrition.ProteinG,
		Fats:     nutrition.FatG,
		Carbs:    nutrition.CarbohydratesG,
	}
	macronutrientsJSON, err := json.Marshal(macros)
	if err != nil {
		return nil, err
	}

	micronutrientsJSON, err := json.Marshal(nutrition.Micronutrients)
	if err != nil {
		return nil, err
	}

	// Convert ingredients
	var ingredientsList []db.IngredientInfo
	for _, ing := range dish.Ingredients {
		ingredientsList = append(ingredientsList, db.IngredientInfo{
			Name:     ing.Name,
			Quantity: ing.QuantityEstimation.Value,
			Unit:     ing.QuantityEstimation.Unit,
			Type:     ing.Type,
			State:    ing.State,
		})
	}
	ingredientsJSON, err := json.Marshal(ingredientsList)
	if err != nil {
		return nil, err
	}

	return &db.FoodItem{
		ID:             nanoid.Must(),
		Name:           nutrition.Name,
		Calories:       int(nutrition.CaloriesKcal),
		Macronutrients: macronutrientsJSON,
		Micronutrients: micronutrientsJSON,
		Ingredients:    ingredientsJSON,
	}, nil
}

// calculateQuantity determines the quantity from ingredients
func calculateQuantity(ingredients []ai.Ingredient) float64 {
	for _, ingredient := range ingredients {
		if ingredient.QuantityEstimation.Unit == "gram" {
			return ingredient.QuantityEstimation.Value
		}
	}
	return 100.0 // Default to 100g
}
