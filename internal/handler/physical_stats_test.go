package handler_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"wellie/internal/contract"
	"wellie/internal/testutils"
)

func TestSavePhysicalStats_Success(t *testing.T) {
	e := testutils.SetupHandlerDependencies(t)

	authResp, err := testutils.AuthHelper(t, e, testutils.TelegramTestUserID, "testuser", "Test User")
	if err != nil {
		t.Fatalf("Failed to authenticate: %v", err)
	}

	reqBody := contract.SavePhysicalStatsRequest{
		Weight:            75.5,
		Height:            180.0,
		Gender:            "male",
		BodyFatPercentage: 15.0,
	}
	body, _ := json.Marshal(reqBody)

	rec := testutils.PerformRequest(t, e, http.MethodPost, "/v1/physical-stats", string(body), authResp.Token, http.StatusOK)

	resp := testutils.ParseResponse[contract.SavePhysicalStatsResponse](t, rec)

	if resp.User.PhysicalStats == nil {
		t.Error("Expected non-nil physical stats in response")
	} else {
		stats := resp.User.PhysicalStats
		if stats.Weight != reqBody.Weight {
			t.Errorf("Expected weight %.1f, got %.1f", reqBody.Weight, stats.Weight)
		}
		if stats.Height != reqBody.Height {
			t.Errorf("Expected height %.1f, got %.1f", reqBody.Height, stats.Height)
		}
		if stats.Gender != reqBody.Gender {
			t.Errorf("Expected gender %s, got %s", reqBody.Gender, stats.Gender)
		}
		if stats.BodyFatPercentage != reqBody.BodyFatPercentage {
			t.Errorf("Expected body fat percentage %.1f, got %.1f", reqBody.BodyFatPercentage, stats.BodyFatPercentage)
		}
	}

	dbStorage := testutils.GetDBStorage()
	user, err := dbStorage.GetUserByID(resp.User.ID)
	if err != nil {
		t.Fatalf("Failed to get user from database: %v", err)
	}

	if user.PhysicalStats == nil {
		t.Error("Expected non-nil physical stats in database")
	} else {
		stats := user.PhysicalStats
		if stats.Weight != reqBody.Weight {
			t.Errorf("Expected weight %.1f in database, got %.1f", reqBody.Weight, stats.Weight)
		}
	}
}

func TestSavePhysicalStats_ValidationFailure(t *testing.T) {
	e := testutils.SetupHandlerDependencies(t)

	authResp, err := testutils.AuthHelper(t, e, testutils.TelegramTestUserID, "testuser", "Test User")
	if err != nil {
		t.Fatalf("Failed to authenticate: %v", err)
	}

	testCases := []struct {
		name          string
		request       contract.SavePhysicalStatsRequest
		expectedError string
	}{
		{
			name: "invalid weight",
			request: contract.SavePhysicalStatsRequest{
				Weight: 0,
				Height: 180.0,
				Gender: "male",
			},
			expectedError: "weight must be greater than 0",
		},
		{
			name: "invalid height",
			request: contract.SavePhysicalStatsRequest{
				Weight: 75.5,
				Height: 0,
				Gender: "male",
			},
			expectedError: "height must be greater than 0",
		},
		{
			name: "empty gender",
			request: contract.SavePhysicalStatsRequest{
				Weight: 75.5,
				Height: 180.0,
				Gender: "",
			},
			expectedError: "gender cannot be empty",
		},
		{
			name: "invalid gender value",
			request: contract.SavePhysicalStatsRequest{
				Weight: 75.5,
				Height: 180.0,
				Gender: "invalid",
			},
			expectedError: "gender must be 'male', 'female', or 'other'",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.request)
			rec := testutils.PerformRequest(
				t,
				e,
				http.MethodPost,
				"/v1/physical-stats",
				string(body),
				authResp.Token,
				http.StatusBadRequest,
			)

			resp := testutils.ParseResponse[contract.ErrorResponse](t, rec)
			if resp.Error != tc.expectedError {
				t.Errorf("Expected error '%s', got '%s'", tc.expectedError, resp.Error)
			}
		})
	}
}

func TestSavePhysicalStats_Unauthorized(t *testing.T) {
	e := testutils.SetupHandlerDependencies(t)

	reqBody := contract.SavePhysicalStatsRequest{
		Weight: 75.5,
		Height: 180.0,
		Gender: "male",
	}
	body, _ := json.Marshal(reqBody)

	testutils.PerformRequest(
		t,
		e,
		http.MethodPost,
		"/v1/physical-stats",
		string(body),
		"",
		http.StatusUnauthorized,
	)

	testutils.PerformRequest(
		t,
		e,
		http.MethodPost,
		"/v1/physical-stats",
		string(body),
		"invalid-token",
		http.StatusUnauthorized,
	)
}
