CREATE TABLE IF NOT EXISTS quest_claims (
    user_id BIGINT UNSIGNED NOT NULL,
    quest_date DATE NOT NULL,
    quest_id VARCHAR(32) NOT NULL,
    claimed_at DATETIME NOT NULL,
    PRIMARY KEY (user_id, quest_date, quest_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB
