CREATE DATABASE IF NOT EXISTS sfashionsdb;
USE sfashionsdb;

CREATE TABLE IF NOT EXISTS Users_2NF (
  user_id INT PRIMARY KEY,
  user_name VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS Garment_2NF (
  garment_name VARCHAR(50) PRIMARY KEY,
  category_name VARCHAR(50),
  price INT,
  gender VARCHAR(20) DEFAULT 'Unisex'
);

CREATE TABLE IF NOT EXISTS Orders_2NF (
  order_id INT PRIMARY KEY,
  user_id INT,
  FOREIGN KEY (user_id) REFERENCES Users_2NF(user_id)
);

CREATE TABLE IF NOT EXISTS Order_Items_2NF (
  order_id INT NOT NULL,
  garment_id INT NOT NULL,
  quantity INT,
  PRIMARY KEY (order_id, garment_id),
  FOREIGN KEY (order_id) REFERENCES Orders_2NF(order_id)
);

CREATE TABLE IF NOT EXISTS Address_2NF (
  user_id INT,
  city VARCHAR(50),
  state VARCHAR(50),
  FOREIGN KEY (user_id) REFERENCES Users_2NF(user_id)
);

INSERT IGNORE INTO Users_2NF (user_id, user_name) VALUES
  (1, 'Aarohi'),
  (2, 'Rohan'),
  (3, 'Meera'),
  (4, 'Arjun'),
  (5, 'Sneha');

INSERT IGNORE INTO Garment_2NF (garment_name, category_name, price, gender) VALUES
  ('Silk Kurta', 'Ethnic Wear', 1499, 'Women'),
  ('Denim Jacket', 'Outerwear', 2299, 'Unisex'),
  ('Floral Saree', 'Ethnic Wear', 3499, 'Women'),
  ('Cotton Chinos', 'Bottomwear', 999, 'Men'),
  ('Linen Shirt', 'Casual Wear', 1299, 'Men');

INSERT IGNORE INTO Orders_2NF (order_id, user_id) VALUES
  (101, 5),
  (102, 2),
  (103, 3),
  (104, 4),
  (105, 5);

INSERT IGNORE INTO Order_Items_2NF (order_id, garment_id, quantity) VALUES
  (1, 1, 3),
  (1, 2, 2),
  (2, 3, 3),
  (2, 4, 2),
  (3, 5, 1);

INSERT IGNORE INTO Address_2NF (user_id, city, state) VALUES
  (1, 'Chennai', 'Tamil Nadu'),
  (2, 'Bangalore', 'Karnataka'),
  (3, 'Hyderabad', 'Telangana'),
  (4, 'Delhi', 'Delhi'),
  (5, 'Pune', 'Maharashtra');
