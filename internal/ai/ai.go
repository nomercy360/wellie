package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type Service struct {
	apiKey     string
	httpClient *http.Client
}

func NewService(apiKey string) *Service {
	return &Service{
		apiKey:     apiKey,
		httpClient: &http.Client{},
	}
}

type DishDetectionRequest struct {
	Model           string           `json:"model"`
	Input           []map[string]any `json:"input"`
	Text            map[string]any   `json:"text"`
	Tools           []any            `json:"tools"`
	Temperature     float64          `json:"temperature"`
	MaxOutputTokens int              `json:"max_output_tokens"`
	TopP            float64          `json:"top_p"`
	Store           bool             `json:"store"`
}

type DishNutritionRequest struct {
	Model     string            `json:"model"`
	Input     []map[string]any  `json:"input"`
	Text      map[string]any    `json:"text"`
	Reasoning map[string]string `json:"reasoning"`
	Tools     []any             `json:"tools"`
	Store     bool              `json:"store"`
}

type DishDetectionResponse struct {
	DetectedDishes      []DetectedDish  `json:"detected_dishes"`
	OverallConfidence   float64         `json:"overall_confidence"`
	UnidentifiableItems []string        `json:"unidentifiable_items"`
	ImageAssessment     ImageAssessment `json:"image_assessment"`
}

type DetectedDish struct {
	DishName                   DishName     `json:"dish_name"`
	Ingredients                []Ingredient `json:"ingredients"`
	PreparationMethodGuess     string       `json:"preparation_method_guess"`
	PotentialHiddenIngredients []string     `json:"potential_hidden_ingredients"`
}

type DishName struct {
	Value        string   `json:"value"`
	Confidence   float64  `json:"confidence"`
	Alternatives []string `json:"alternatives"`
}

type Ingredient struct {
	Name               string             `json:"name"`
	Type               string             `json:"type"`
	State              string             `json:"state"`
	Confidence         float64            `json:"confidence"`
	QuantityEstimation QuantityEstimation `json:"quantity_estimation"`
}

type QuantityEstimation struct {
	Value           float64 `json:"value"`
	Unit            string  `json:"unit"`
	EstimationBasis string  `json:"estimation_basis"`
}

type ImageAssessment struct {
	Clarity      string `json:"clarity"`
	Lighting     string `json:"lighting"`
	Obstructions string `json:"obstructions"`
}

type DishNutritionResponse struct {
	Name           string         `json:"name"`
	CaloriesKcal   float64        `json:"calories_kcal"`
	ProteinG       float64        `json:"protein_g"`
	CarbohydratesG float64        `json:"carbohydrates_g"`
	FatG           float64        `json:"fat_g"`
	Micronutrients Micronutrients `json:"micronutrients"`
}

type Micronutrients struct {
	SodiumMg    int     `json:"sodium_mg"`
	FiberG      float64 `json:"fiber_g"`
	SugarG      float64 `json:"sugar_g"`
	IronMg      float64 `json:"iron_mg"`
	CalciumMg   int     `json:"calcium_mg"`
	VitaminCMg  float64 `json:"vitamin_c_mg"`
	VitaminAIU  int     `json:"vitamin_a_iu"`
	PotassiumMg int     `json:"potassium_mg"`
}

func (s *Service) DetectDish(ctx context.Context, imageURL string, promptTemplate []byte) (*DishDetectionResponse, error) {
	// Replace the template placeholder with actual image URL
	promptStr := strings.Replace(string(promptTemplate), "{{imageURL}}", imageURL, 1)

	var request DishDetectionRequest
	if err := json.Unmarshal([]byte(promptStr), &request); err != nil {
		return nil, fmt.Errorf("failed to unmarshal prompt template: %w", err)
	}

	resp, err := s.makeRequest(ctx, "https://api.openai.com/v1/responses", request)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var apiResponse struct {
		Output []struct {
			Content []struct {
				Text string `json:"text"`
			} `json:"content"`
		} `json:"output"`
	}

	if err := json.Unmarshal(body, &apiResponse); err != nil {
		return nil, fmt.Errorf("failed to unmarshal API response: %w", err)
	}

	if len(apiResponse.Output) == 0 {
		return nil, fmt.Errorf("no choices in API response")
	}

	var result DishDetectionResponse
	if err := json.Unmarshal([]byte(apiResponse.Output[0].Content[0].Text), &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal dish detection result: %w", err)
	}

	return &result, nil
}

func (s *Service) AnalyzeNutrition(ctx context.Context, dishDescription string, promptTemplate []byte) (*DishNutritionResponse, error) {
	// Replace the template placeholder with actual dish description
	promptStr := strings.Replace(string(promptTemplate), "{{dishDescription}}", dishDescription, 1)

	var request DishNutritionRequest
	if err := json.Unmarshal([]byte(promptStr), &request); err != nil {
		return nil, fmt.Errorf("failed to unmarshal prompt template: %w", err)
	}

	resp, err := s.makeRequest(ctx, "https://api.openai.com/v1/responses", request)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var apiResponse struct {
		Output []struct {
			Content []struct {
				Text string `json:"text"`
			} `json:"content"`
		} `json:"output"`
	}

	if err := json.Unmarshal(body, &apiResponse); err != nil {
		return nil, fmt.Errorf("failed to unmarshal API response: %w", err)
	}

	if len(apiResponse.Output) == 0 {
		return nil, fmt.Errorf("no choices in API response")
	}

	var result DishNutritionResponse
	if err := json.Unmarshal([]byte(apiResponse.Output[0].Content[0].Text), &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal nutrition result: %w", err)
	}

	return &result, nil
}

func (s *Service) makeRequest(ctx context.Context, url string, payload interface{}) (*http.Response, error) {
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	return resp, nil
}
