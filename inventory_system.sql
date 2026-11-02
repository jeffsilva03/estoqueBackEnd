-- Estrutura pública para desenvolvimento; sem dados de usuários, contatos ou senhas.
-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `inventory_system`
--

DELIMITER $$
--
-- Procedures
--
CREATE PROCEDURE `AdjustStock` (IN `p_product_id` INT, IN `p_new_quantity` INT, IN `p_notes` TEXT)   BEGIN
    DECLARE current_stock INT;
    DECLARE difference INT;
    
    -- Buscar estoque atual
    SELECT stock_quantity INTO current_stock 
    FROM products 
    WHERE id = p_product_id;
    
    -- Calcular diferença
    SET difference = p_new_quantity - current_stock;
    
    -- Atualizar produto
    UPDATE products 
    SET stock_quantity = p_new_quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_product_id;
    
    -- Registrar movimentação
    INSERT INTO stock_movements (
        product_id, 
        movement_type, 
        quantity, 
        previous_stock, 
        new_stock, 
        reference_type,
        notes
    ) VALUES (
        p_product_id,
        'adjustment',
        difference,
        current_stock,
        p_new_quantity,
        'adjustment',
        p_notes
    );
END$$

CREATE PROCEDURE `GetSalesReport` (IN `start_date` DATE, IN `end_date` DATE)   BEGIN
    SELECT 
        DATE(s.sale_date) as date,
        COUNT(s.id) as total_sales,
        SUM(s.final_amount) as total_revenue,
        AVG(s.final_amount) as avg_sale_value,
        SUM(si.quantity) as total_items_sold
    FROM sales s
    LEFT JOIN sale_items si ON s.id = si.sale_id
    WHERE DATE(s.sale_date) BETWEEN start_date AND end_date
    AND s.status = 'completed'
    GROUP BY DATE(s.sale_date)
    ORDER BY date DESC;
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(50) DEFAULT NULL,
  `zip_code` varchar(10) DEFAULT NULL,
  `tax_id` varchar(20) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `customer_type` enum('individual','business') DEFAULT 'individual',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` int(11) NOT NULL,
  `name` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `sku` varchar(50) NOT NULL,
  `barcode` varchar(50) DEFAULT NULL,
  `category_id` int(11) DEFAULT NULL,
  `supplier_id` int(11) DEFAULT NULL,
  `cost_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `selling_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `stock_quantity` int(11) NOT NULL DEFAULT 0,
  `min_stock_level` int(11) NOT NULL DEFAULT 0,
  `max_stock_level` int(11) DEFAULT NULL,
  `unit` varchar(10) DEFAULT 'un',
  `weight` decimal(8,3) DEFAULT NULL,
  `dimensions` varchar(50) DEFAULT NULL,
  `location` varchar(50) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------

--
-- Table structure for table `purchases`
--

CREATE TABLE `purchases` (
  `id` int(11) NOT NULL,
  `supplier_id` int(11) DEFAULT NULL,
  `purchase_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `total_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(10,2) DEFAULT 0.00,
  `final_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` enum('pending','received','partial','cancelled') DEFAULT 'pending',
  `payment_status` enum('pending','paid','partial') DEFAULT 'pending',
  `invoice_number` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchase_items`
--

CREATE TABLE `purchase_items` (
  `id` int(11) NOT NULL,
  `purchase_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `unit_cost` decimal(10,2) NOT NULL,
  `total_cost` decimal(10,2) NOT NULL,
  `received_quantity` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sales`
--

CREATE TABLE `sales` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `sale_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `total_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(10,2) DEFAULT 0.00,
  `final_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `payment_method` enum('cash','card','pix','transfer','check','other') DEFAULT 'cash',
  `payment_status` enum('pending','paid','partial','cancelled') DEFAULT 'paid',
  `status` enum('completed','pending','cancelled') DEFAULT 'completed',
  `notes` text DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------

--
-- Table structure for table `sale_items`
--

CREATE TABLE `sale_items` (
  `id` int(11) NOT NULL,
  `sale_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `discount_amount` decimal(10,2) DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


--
-- Triggers `sale_items`
--
DELIMITER $$
CREATE TRIGGER `after_sale_item_insert` AFTER INSERT ON `sale_items` FOR EACH ROW BEGIN
    DECLARE prev_stock INT;
    
    -- Buscar estoque anterior
    SELECT stock_quantity INTO prev_stock 
    FROM products 
    WHERE id = NEW.product_id;
    
    -- Registrar movimentação
    INSERT INTO stock_movements (
        product_id, 
        movement_type, 
        quantity, 
        previous_stock, 
        new_stock, 
        reference_type, 
        reference_id,
        notes
    ) VALUES (
        NEW.product_id,
        'out',
        NEW.quantity,
        prev_stock,
        prev_stock - NEW.quantity,
        'sale',
        NEW.sale_id,
        CONCAT('Venda #', NEW.sale_id)
    );
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `stock_movements`
--

CREATE TABLE `stock_movements` (
  `id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `movement_type` enum('in','out','adjustment','transfer') NOT NULL,
  `quantity` int(11) NOT NULL,
  `previous_stock` int(11) DEFAULT NULL,
  `new_stock` int(11) DEFAULT NULL,
  `reference_type` enum('sale','purchase','adjustment','transfer','return','loss') DEFAULT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `cost_price` decimal(10,2) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


--
-- Triggers `stock_movements`
--
DELIMITER $$
CREATE TRIGGER `after_stock_movement_insert` AFTER INSERT ON `stock_movements` FOR EACH ROW BEGIN
    IF NEW.movement_type != 'adjustment' THEN
        UPDATE products 
        SET stock_quantity = NEW.new_stock,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.product_id;
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `suppliers`
--

CREATE TABLE `suppliers` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `contact_person` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(50) DEFAULT NULL,
  `zip_code` varchar(10) DEFAULT NULL,
  `tax_id` varchar(20) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `role` enum('admin','manager','employee','viewer') DEFAULT 'employee',
  `is_active` tinyint(1) DEFAULT 1,
  `last_login` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------

--
-- Stand-in structure for view `v_products_complete`
-- (See below for the actual view)
--
CREATE TABLE `v_products_complete` (
`id` int(11)
,`name` varchar(200)
,`description` text
,`sku` varchar(50)
,`barcode` varchar(50)
,`category_id` int(11)
,`supplier_id` int(11)
,`cost_price` decimal(10,2)
,`selling_price` decimal(10,2)
,`stock_quantity` int(11)
,`min_stock_level` int(11)
,`max_stock_level` int(11)
,`unit` varchar(10)
,`weight` decimal(8,3)
,`dimensions` varchar(50)
,`location` varchar(50)
,`is_active` tinyint(1)
,`created_at` timestamp
,`updated_at` timestamp
,`category_name` varchar(100)
,`supplier_name` varchar(150)
,`supplier_contact` varchar(100)
,`stock_status` varchar(6)
,`profit_margin` decimal(11,2)
,`profit_percentage` decimal(20,6)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_sales_complete`
-- (See below for the actual view)
--
CREATE TABLE `v_sales_complete` (
`id` int(11)
,`customer_id` int(11)
,`sale_date` timestamp
,`total_amount` decimal(10,2)
,`discount` decimal(10,2)
,`final_amount` decimal(10,2)
,`payment_method` enum('cash','card','pix','transfer','check','other')
,`payment_status` enum('pending','paid','partial','cancelled')
,`status` enum('completed','pending','cancelled')
,`notes` text
,`user_id` int(11)
,`created_at` timestamp
,`updated_at` timestamp
,`customer_name` varchar(150)
,`customer_email` varchar(100)
,`customer_phone` varchar(20)
,`total_items` bigint(21)
,`total_quantity` decimal(32,0)
);

-- --------------------------------------------------------

--
-- Structure for view `v_products_complete`
--
DROP TABLE IF EXISTS `v_products_complete`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_products_complete`  AS SELECT `p`.`id` AS `id`, `p`.`name` AS `name`, `p`.`description` AS `description`, `p`.`sku` AS `sku`, `p`.`barcode` AS `barcode`, `p`.`category_id` AS `category_id`, `p`.`supplier_id` AS `supplier_id`, `p`.`cost_price` AS `cost_price`, `p`.`selling_price` AS `selling_price`, `p`.`stock_quantity` AS `stock_quantity`, `p`.`min_stock_level` AS `min_stock_level`, `p`.`max_stock_level` AS `max_stock_level`, `p`.`unit` AS `unit`, `p`.`weight` AS `weight`, `p`.`dimensions` AS `dimensions`, `p`.`location` AS `location`, `p`.`is_active` AS `is_active`, `p`.`created_at` AS `created_at`, `p`.`updated_at` AS `updated_at`, `c`.`name` AS `category_name`, `s`.`name` AS `supplier_name`, `s`.`contact_person` AS `supplier_contact`, CASE WHEN `p`.`stock_quantity` <= `p`.`min_stock_level` THEN 'Baixo' WHEN `p`.`stock_quantity` > `p`.`min_stock_level` * 2 THEN 'Alto' ELSE 'Normal' END AS `stock_status`, `p`.`selling_price`- `p`.`cost_price` AS `profit_margin`, (`p`.`selling_price` - `p`.`cost_price`) / `p`.`cost_price` * 100 AS `profit_percentage` FROM ((`products` `p` left join `categories` `c` on(`p`.`category_id` = `c`.`id`)) left join `suppliers` `s` on(`p`.`supplier_id` = `s`.`id`)) ;

-- --------------------------------------------------------

--
-- Structure for view `v_sales_complete`
--
DROP TABLE IF EXISTS `v_sales_complete`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_sales_complete`  AS SELECT `s`.`id` AS `id`, `s`.`customer_id` AS `customer_id`, `s`.`sale_date` AS `sale_date`, `s`.`total_amount` AS `total_amount`, `s`.`discount` AS `discount`, `s`.`final_amount` AS `final_amount`, `s`.`payment_method` AS `payment_method`, `s`.`payment_status` AS `payment_status`, `s`.`status` AS `status`, `s`.`notes` AS `notes`, `s`.`user_id` AS `user_id`, `s`.`created_at` AS `created_at`, `s`.`updated_at` AS `updated_at`, `c`.`name` AS `customer_name`, `c`.`email` AS `customer_email`, `c`.`phone` AS `customer_phone`, count(`si`.`id`) AS `total_items`, sum(`si`.`quantity`) AS `total_quantity` FROM ((`sales` `s` left join `customers` `c` on(`s`.`customer_id` = `c`.`id`)) left join `sale_items` `si` on(`s`.`id` = `si`.`sale_id`)) GROUP BY `s`.`id` ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_customer_name` (`name`),
  ADD KEY `idx_customer_email` (`email`),
  ADD KEY `idx_customer_phone` (`phone`),
  ADD KEY `idx_customer_active` (`is_active`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `sku` (`sku`),
  ADD KEY `idx_product_sku` (`sku`),
  ADD KEY `idx_product_barcode` (`barcode`),
  ADD KEY `idx_product_name` (`name`),
  ADD KEY `idx_product_category` (`category_id`),
  ADD KEY `idx_product_supplier` (`supplier_id`),
  ADD KEY `idx_product_active` (`is_active`),
  ADD KEY `idx_stock_level` (`stock_quantity`,`min_stock_level`),
  ADD KEY `idx_products_category_active` (`category_id`,`is_active`);

--
-- Indexes for table `purchases`
--
ALTER TABLE `purchases`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_purchase_date` (`purchase_date`),
  ADD KEY `idx_purchase_supplier` (`supplier_id`),
  ADD KEY `idx_purchase_status` (`status`);

--
-- Indexes for table `purchase_items`
--
ALTER TABLE `purchase_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_purchase_item_purchase` (`purchase_id`),
  ADD KEY `idx_purchase_item_product` (`product_id`);

--
-- Indexes for table `sales`
--
ALTER TABLE `sales`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sale_date` (`sale_date`),
  ADD KEY `idx_sale_customer` (`customer_id`),
  ADD KEY `idx_sale_status` (`status`),
  ADD KEY `idx_payment_status` (`payment_status`),
  ADD KEY `idx_payment_method` (`payment_method`),
  ADD KEY `idx_sales_date_status` (`sale_date`,`status`);

--
-- Indexes for table `sale_items`
--
ALTER TABLE `sale_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sale_item_sale` (`sale_id`),
  ADD KEY `idx_sale_item_product` (`product_id`);

--
-- Indexes for table `stock_movements`
--
ALTER TABLE `stock_movements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_movement_product` (`product_id`),
  ADD KEY `idx_movement_type` (`movement_type`),
  ADD KEY `idx_movement_date` (`created_at`),
  ADD KEY `idx_movement_reference` (`reference_type`,`reference_id`),
  ADD KEY `idx_stock_movements_product_date` (`product_id`,`created_at`);

--
-- Indexes for table `suppliers`
--
ALTER TABLE `suppliers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_supplier_name` (`name`),
  ADD KEY `idx_supplier_active` (`is_active`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_user_username` (`username`),
  ADD KEY `idx_user_email` (`email`),
  ADD KEY `idx_user_active` (`is_active`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `purchases`
--
ALTER TABLE `purchases`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `purchase_items`
--
ALTER TABLE `purchase_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sales`
--
ALTER TABLE `sales`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `sale_items`
--
ALTER TABLE `sale_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `stock_movements`
--
ALTER TABLE `stock_movements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `suppliers`
--
ALTER TABLE `suppliers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `products_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `products_ibfk_2` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `purchases`
--
ALTER TABLE `purchases`
  ADD CONSTRAINT `purchases_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `purchase_items`
--
ALTER TABLE `purchase_items`
  ADD CONSTRAINT `purchase_items_ibfk_1` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `purchase_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `sales`
--
ALTER TABLE `sales`
  ADD CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `sale_items`
--
ALTER TABLE `sale_items`
  ADD CONSTRAINT `sale_items_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `sale_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `stock_movements`
--
ALTER TABLE `stock_movements`
  ADD CONSTRAINT `stock_movements_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
