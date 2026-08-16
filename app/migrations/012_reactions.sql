CREATE TABLE IF NOT EXISTS reaction_counts (
  action VARCHAR(16) NOT NULL,
  target_id VARCHAR(32) NOT NULL,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (action, target_id)
)
