package db

func (s *Storage) UpdateSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
	   id TEXT PRIMARY KEY,
	   telegram_id INTEGER UNIQUE,
	   deleted_at TIMESTAMP,
	   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	   username TEXT,
	   avatar_url TEXT,
	   name TEXT,
	   physical_stats JSON
	);

	CREATE TABLE IF NOT EXISTS goals (
	   id TEXT PRIMARY KEY,
	   user_id TEXT NOT NULL,
	   goal_type TEXT NOT NULL, -- 'lose_weight', 'gain_muscle', 'maintain'
	   pace TEXT, -- 'fast', 'optimal', 'slow'
	   target_weight REAL,
	   start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	   target_date TIMESTAMP,
	   is_active BOOLEAN DEFAULT TRUE,
	   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	   FOREIGN KEY (user_id) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS nutrition_plans (
	   id TEXT PRIMARY KEY,
	   user_id TEXT NOT NULL,
	   calories INTEGER NOT NULL,
	   proteins INTEGER NOT NULL,
	   fats INTEGER NOT NULL,
	   carbs INTEGER NOT NULL,
	   start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	   end_date TIMESTAMP,
	   is_active BOOLEAN DEFAULT TRUE,
	   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	   FOREIGN KEY (user_id) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS food_items (
	   id TEXT PRIMARY KEY,
	   name TEXT NOT NULL,
	   barcode TEXT,
	   calories INTEGER NOT NULL,
	   macronutrients JSON NOT NULL,
	   micronutrients JSON,
	   ingredients JSON,
	   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS food_logs (
	   id TEXT PRIMARY KEY,
	   user_id TEXT NOT NULL,
	   food_item_id TEXT NOT NULL,
	   quantity REAL NOT NULL,
	   meal_type TEXT NOT NULL, -- 'breakfast', 'lunch', 'dinner', 'snack'
	   image_url TEXT,
	   log_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	   FOREIGN KEY (user_id) REFERENCES users(id),
	   FOREIGN KEY (food_item_id) REFERENCES food_items(id)
	);

	CREATE TABLE IF NOT EXISTS weight_logs (
	   id TEXT PRIMARY KEY,
	   user_id TEXT NOT NULL,
	   weight REAL NOT NULL,
	   log_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	   FOREIGN KEY (user_id) REFERENCES users(id)
	);
	`

	_, err := s.db.Exec(schema)
	if err != nil {
		return err
	}

	return nil
}
