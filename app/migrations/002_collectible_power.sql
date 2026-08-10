ALTER TABLE collectibles ADD COLUMN power INT UNSIGNED NOT NULL DEFAULT 10;
UPDATE collectibles SET power = CASE rarity
    WHEN 'Common' THEN 10
    WHEN 'Uncommon' THEN 20
    WHEN 'Rare' THEN 35
    WHEN 'Epic' THEN 55
    WHEN 'Legendary' THEN 80
    WHEN 'Mythic' THEN 120
    ELSE 10 END
