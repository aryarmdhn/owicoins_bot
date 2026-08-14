CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    discord_id VARCHAR(32) NOT NULL UNIQUE,
    username VARCHAR(255) NOT NULL,
    coins BIGINT UNSIGNED NOT NULL DEFAULT 1000,
    xp BIGINT UNSIGNED NOT NULL DEFAULT 0,
    level INT UNSIGNED NOT NULL DEFAULT 1,
    daily_streak INT UNSIGNED NOT NULL DEFAULT 0,
    last_daily_at DATETIME NULL,
    last_work_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS collectibles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rarity VARCHAR(32) NOT NULL,
    category VARCHAR(64) NOT NULL,
    base_value BIGINT UNSIGNED NOT NULL,
    image_url TEXT,
    is_limited BOOLEAN NOT NULL DEFAULT FALSE,
    season VARCHAR(64) NULL,
    created_at DATETIME NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventories (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    collectible_id BIGINT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY unique_inventory (user_id, collectible_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (collectible_id) REFERENCES collectibles(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gacha_transactions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    pull_count INT UNSIGNED NOT NULL,
    cost BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gacha_results (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    gacha_transaction_id BIGINT UNSIGNED NOT NULL,
    collectible_id BIGINT UNSIGNED NOT NULL,
    rarity VARCHAR(32) NOT NULL,
    FOREIGN KEY (gacha_transaction_id) REFERENCES gacha_transactions(id),
    FOREIGN KEY (collectible_id) REFERENCES collectibles(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trades (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trade_code VARCHAR(32) NOT NULL UNIQUE,
    sender_id BIGINT UNSIGNED NOT NULL,
    receiver_id BIGINT UNSIGNED NOT NULL,
    sender_coins BIGINT UNSIGNED NOT NULL DEFAULT 0,
    receiver_coins BIGINT UNSIGNED NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trade_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trade_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    collectible_id BIGINT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    FOREIGN KEY (trade_id) REFERENCES trades(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (collectible_id) REFERENCES collectibles(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS economy_transactions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    type VARCHAR(64) NOT NULL,
    amount BIGINT NOT NULL,
    balance_after BIGINT UNSIGNED NOT NULL,
    reference_id VARCHAR(128),
    created_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE KEY unique_reference (type, reference_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS settings (
    `key` VARCHAR(64) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME NOT NULL,
    updated_by VARCHAR(32) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_luck (
    user_id BIGINT UNSIGNED PRIMARY KEY,
    multiplier DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    rigged TINYINT(1) NOT NULL DEFAULT 0,
    expires_at DATETIME NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB
