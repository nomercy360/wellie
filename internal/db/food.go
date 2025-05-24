package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

type FoodItem struct {
	ID             string          `json:"id"`
	Name           string          `json:"name"`
	Barcode        *string         `json:"barcode,omitempty"`
	Calories       int             `json:"calories"`
	Macronutrients json.RawMessage `json:"macronutrients"`
	Micronutrients json.RawMessage `json:"micronutrients,omitempty"`
	Ingredients    json.RawMessage `json:"ingredients,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

type Macronutrients struct {
	Proteins float64 `json:"proteins_g"`
	Fats     float64 `json:"fats_g"`
	Carbs    float64 `json:"carbs_g"`
}

type IngredientInfo struct {
	Name     string  `json:"name"`
	Quantity float64 `json:"quantity"`
	Unit     string  `json:"unit"`
	Type     string  `json:"type"`
	State    string  `json:"state"`
}

type FoodLog struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	FoodItemID string    `json:"food_item_id"`
	Quantity   float64   `json:"quantity"`
	MealType   string    `json:"meal_type"`
	ImageURL   *string   `json:"image_url,omitempty"`
	LogDate    time.Time `json:"log_date"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func (s *Storage) CreateFoodItem(ctx context.Context, item *FoodItem) error {
	macronutrientsJSON, err := json.Marshal(item.Macronutrients)
	if err != nil {
		return fmt.Errorf("failed to marshal macronutrients: %w", err)
	}

	micronutrientsJSON, err := json.Marshal(item.Micronutrients)
	if err != nil {
		return fmt.Errorf("failed to marshal micronutrients: %w", err)
	}

	ingredientsJSON, err := json.Marshal(item.Ingredients)
	if err != nil {
		return fmt.Errorf("failed to marshal ingredients: %w", err)
	}

	query := `
		INSERT INTO food_items (id, name, barcode, calories, macronutrients, micronutrients, ingredients)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`

	_, err = s.db.ExecContext(ctx, query,
		item.ID, item.Name, item.Barcode, item.Calories,
		macronutrientsJSON, micronutrientsJSON, ingredientsJSON)

	if err != nil {
		return fmt.Errorf("failed to create food item: %w", err)
	}

	return nil
}

func (s *Storage) GetFoodItemByName(ctx context.Context, name string) (*FoodItem, error) {
	query := `
		SELECT id, name, barcode, calories, macronutrients, micronutrients, ingredients, created_at, updated_at
		FROM food_items
		WHERE name = ?
		LIMIT 1
	`

	var item FoodItem
	var macronutrientsJSON sql.NullString
	var micronutrientsJSON sql.NullString
	var ingredientsJSON sql.NullString

	err := s.db.QueryRowContext(ctx, query, name).Scan(
		&item.ID, &item.Name, &item.Barcode, &item.Calories,
		&macronutrientsJSON, &micronutrientsJSON, &ingredientsJSON,
		&item.CreatedAt, &item.UpdatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get food item: %w", err)
	}

	if macronutrientsJSON.Valid {
		item.Macronutrients = json.RawMessage(macronutrientsJSON.String)
	}

	if micronutrientsJSON.Valid {
		item.Micronutrients = json.RawMessage(micronutrientsJSON.String)
	}

	if ingredientsJSON.Valid {
		item.Ingredients = json.RawMessage(ingredientsJSON.String)
	}

	return &item, nil
}

func (s *Storage) CreateFoodLog(ctx context.Context, log *FoodLog) error {
	query := `
		INSERT INTO food_logs (id, user_id, food_item_id, quantity, meal_type, image_url, log_date)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`

	_, err := s.db.ExecContext(ctx, query,
		log.ID, log.UserID, log.FoodItemID, log.Quantity,
		log.MealType, log.ImageURL, log.LogDate)

	if err != nil {
		return fmt.Errorf("failed to create food log: %w", err)
	}

	return nil
}

func (s *Storage) GetUserFoodLogs(ctx context.Context, userID string, date time.Time) ([]*FoodLog, error) {
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	query := `
		SELECT id, user_id, food_item_id, quantity, meal_type, image_url, log_date, created_at, updated_at
		FROM food_logs
		WHERE user_id = ? AND log_date >= ? AND log_date < ?
		ORDER BY log_date
	`

	rows, err := s.db.QueryContext(ctx, query, userID, startOfDay, endOfDay)
	if err != nil {
		return nil, fmt.Errorf("failed to get food logs: %w", err)
	}
	defer rows.Close()

	var logs []*FoodLog
	for rows.Next() {
		var log FoodLog
		err := rows.Scan(
			&log.ID, &log.UserID, &log.FoodItemID, &log.Quantity,
			&log.MealType, &log.ImageURL, &log.LogDate,
			&log.CreatedAt, &log.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan food log: %w", err)
		}
		logs = append(logs, &log)
	}

	return logs, nil
}

func (s *Storage) GetFoodItemByID(ctx context.Context, id string) (*FoodItem, error) {
	query := `
		SELECT id, name, barcode, calories, macronutrients, micronutrients, ingredients, created_at, updated_at
		FROM food_items
		WHERE id = ?
		LIMIT 1
	`

	var item FoodItem
	var macronutrientsJSON sql.NullString
	var micronutrientsJSON sql.NullString
	var ingredientsJSON sql.NullString

	err := s.db.QueryRowContext(ctx, query, id).Scan(
		&item.ID, &item.Name, &item.Barcode, &item.Calories,
		&macronutrientsJSON, &micronutrientsJSON, &ingredientsJSON,
		&item.CreatedAt, &item.UpdatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get food item: %w", err)
	}

	if macronutrientsJSON.Valid {
		item.Macronutrients = json.RawMessage(macronutrientsJSON.String)
	}

	if micronutrientsJSON.Valid {
		item.Micronutrients = json.RawMessage(micronutrientsJSON.String)
	}

	if ingredientsJSON.Valid {
		item.Ingredients = json.RawMessage(ingredientsJSON.String)
	}

	return &item, nil
}

func (s *Storage) GetFoodLogsByFoodItemID(ctx context.Context, foodItemID string) ([]*FoodLog, error) {
	query := `
		SELECT id, user_id, food_item_id, quantity, meal_type, image_url, log_date, created_at, updated_at
		FROM food_logs
		WHERE food_item_id = ?
		ORDER BY log_date DESC
	`

	rows, err := s.db.QueryContext(ctx, query, foodItemID)
	if err != nil {
		return nil, fmt.Errorf("failed to get food logs: %w", err)
	}
	defer rows.Close()

	var logs []*FoodLog
	for rows.Next() {
		var log FoodLog
		err := rows.Scan(
			&log.ID, &log.UserID, &log.FoodItemID, &log.Quantity,
			&log.MealType, &log.ImageURL, &log.LogDate,
			&log.CreatedAt, &log.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan food log: %w", err)
		}
		logs = append(logs, &log)
	}

	return logs, nil
}
