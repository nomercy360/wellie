package db

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

type PhysicalStats struct {
	Weight            float64 `json:"weight"`
	Height            float64 `json:"height"`
	Gender            Gender  `json:"gender"`
	BodyFatPercentage float64 `json:"body_fat_percentage,omitempty"`
} // @Name PhysicalStats

type User struct {
	ID            string         `db:"id" json:"id"`
	TelegramID    int64          `db:"telegram_id" json:"telegram_id"`
	Name          *string        `db:"name" json:"name"`
	Username      *string        `db:"username" json:"username"`
	AvatarURL     *string        `db:"avatar_url" json:"avatar_url"`
	PhysicalStats *PhysicalStats `db:"physical_stats" json:"physical_stats,omitempty"`
	CreatedAt     time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time      `db:"updated_at" json:"updated_at"`
	DeletedAt     *time.Time     `db:"deleted_at" json:"deleted_at"`
} // @Name User

type Gender string // @Name Gender

const (
	GenderMale   Gender = "male"
	GenderFemale Gender = "female"
)

func (s *Storage) GetUser(telegramID int64) (*User, error) {
	var user User
	var physicalStatsJSON sql.NullString

	query := `SELECT id, telegram_id, username, avatar_url, name, physical_stats, created_at, updated_at FROM users WHERE telegram_id = ?`
	err := s.db.QueryRow(query, telegramID).Scan(
		&user.ID,
		&user.TelegramID,
		&user.Username,
		&user.AvatarURL,
		&user.Name,
		&physicalStatsJSON,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("error getting user: %w", err)
	}

	if physicalStatsJSON.Valid && physicalStatsJSON.String != "" {
		var stats PhysicalStats
		if err := json.Unmarshal([]byte(physicalStatsJSON.String), &stats); err != nil {
			return nil, fmt.Errorf("error unmarshaling physical stats: %w", err)
		}
		user.PhysicalStats = &stats
	}

	return &user, nil
}

func (s *Storage) GetUserByID(userID string) (*User, error) {
	var user User
	var physicalStatsJSON sql.NullString

	query := `SELECT id, telegram_id, username, avatar_url, name, physical_stats, created_at, updated_at FROM users WHERE id = ?`
	err := s.db.QueryRow(query, userID).Scan(
		&user.ID,
		&user.TelegramID,
		&user.Username,
		&user.AvatarURL,
		&user.Name,
		&physicalStatsJSON,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("error getting user by ID: %w", err)
	}

	if physicalStatsJSON.Valid && physicalStatsJSON.String != "" {
		var stats PhysicalStats
		if err := json.Unmarshal([]byte(physicalStatsJSON.String), &stats); err != nil {
			return nil, fmt.Errorf("error unmarshaling physical stats: %w", err)
		}
		user.PhysicalStats = &stats
	}

	return &user, nil
}

func (s *Storage) SaveUser(user *User) error {
	query := `
		INSERT INTO users 
		    (id, telegram_id, username, avatar_url, name)
		VALUES (?, ?, ?, ?, ?)`

	_, err := s.db.Exec(query, user.ID, user.TelegramID, user.Username, user.AvatarURL, user.Name)
	if err != nil {
		return fmt.Errorf("error saving user: %w", err)
	}

	return nil
}

func (s *Storage) UpdateUser(user *User) error {
	query := `
		UPDATE users
		SET username = ?, avatar_url = ?, name = ?, updated_at = ?
		WHERE telegram_id = ?`

	now := time.Now()

	_, err := s.db.Exec(query,
		user.Username, user.AvatarURL, user.Name, now, user.TelegramID)
	if err != nil {
		return fmt.Errorf("error updating user: %w", err)
	}

	return nil
}

func (s *Storage) SaveUserPhysicalStats(userID string, stats *PhysicalStats) error {
	query := `
		UPDATE users
		SET physical_stats = json(?), updated_at = ?
		WHERE id = ?`

	now := time.Now()

	statsJSON, err := json.Marshal(stats)
	if err != nil {
		return fmt.Errorf("error marshaling physical stats: %w", err)
	}

	_, err = s.db.Exec(query, string(statsJSON), now, userID)
	if err != nil {
		return fmt.Errorf("error saving physical stats: %w", err)
	}

	return nil
}
