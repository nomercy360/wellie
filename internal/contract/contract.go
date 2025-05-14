package contract

import (
	"fmt"
	"github.com/golang-jwt/jwt/v5"
	"wellie/internal/db"
)

type JWTClaims struct {
	jwt.RegisteredClaims
	UID    string `json:"uid,omitempty"`
	ChatID int64  `json:"chat_id,omitempty"`
}

type AuthTelegramRequest struct {
	Query string `json:"query"`
} // @Name AuthTelegramRequest

type AuthTelegramResponse struct {
	Token string  `json:"token"`
	User  db.User `json:"user"`
} // @Name AuthTelegramResponse

func (a AuthTelegramRequest) Validate() error {
	if a.Query == "" {
		return fmt.Errorf("query cannot be empty")
	}
	return nil
}

type SavePhysicalStatsRequest struct {
	Weight            float64   `json:"weight"`
	Height            float64   `json:"height"`
	Gender            db.Gender `json:"gender"`
	BodyFatPercentage float64   `json:"body_fat_percentage,omitempty"`
} // @Name SavePhysicalStatsRequest

func (s SavePhysicalStatsRequest) Validate() error {
	if s.Weight <= 0 {
		return fmt.Errorf("weight must be greater than 0")
	}
	if s.Height <= 0 {
		return fmt.Errorf("height must be greater than 0")
	}
	if s.Gender == "" {
		return fmt.Errorf("gender cannot be empty")
	}
	if s.Gender != "male" && s.Gender != "female" && s.Gender != "other" {
		return fmt.Errorf("gender must be 'male', 'female', or 'other'")
	}

	return nil
}

type SavePhysicalStatsResponse struct {
	User db.User `json:"user"`
} // @Name SavePhysicalStatsResponse

type ErrorResponse struct {
	Error string `json:"error"`
} // @Name ErrorResponse
