CREATE TABLE IF NOT EXISTS user_achievements (
    user_id BIGINT UNSIGNED NOT NULL,
    achievement_id VARCHAR(64) NOT NULL,
    claimed_at DATETIME NOT NULL,
    PRIMARY KEY (user_id, achievement_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB
