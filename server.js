// server.js
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuração do banco de dados
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'inventory_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Middleware de autenticação (opcional - para versão completa)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token de acesso requerido' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido' });
        req.user = user;
        next();
    });
};

// ========== ROTAS DE PRODUTOS ==========

// Listar todos os produtos
app.get('/api/products', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT p.*, c.name as category_name, s.name as supplier_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.is_active = true
            ORDER BY p.name
        `);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao listar produtos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Buscar produto por ID
app.get('/api/products/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT p.*, c.name as category_name, s.name as supplier_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.id = ?
        `, [req.params.id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar produto:', error);
        res.status(500).json({ error: error.message });
    }
});

// Criar novo produto
app.post('/api/products', async (req, res) => {
    console.log('Dados recebidos:', req.body);
    
    const { 
        name, 
        description, 
        sku, 
        barcode, 
        category_id, 
        supplier_id, 
        cost_price, 
        selling_price, 
        stock_quantity, 
        min_stock_level, 
        unit 
    } = req.body;
    
    // Validação dos campos obrigatórios
    if (!name || !sku || !cost_price || !selling_price) {
        return res.status(400).json({ 
            error: 'Campos obrigatórios: name, sku, cost_price, selling_price' 
        });
    }
    
    try {
        // Converter valores para os tipos corretos e tratar undefined
        const productData = {
            name: name,
            description: description || null,
            sku: sku,
            barcode: barcode || null,
            category_id: category_id || null,
            supplier_id: supplier_id || null,
            cost_price: parseFloat(cost_price),
            selling_price: parseFloat(selling_price),
            stock_quantity: parseInt(stock_quantity) || 0,
            min_stock_level: parseInt(min_stock_level) || 0,
            unit: unit || 'un'
        };
        
        console.log('Dados processados:', productData);
        
        const [result] = await pool.execute(`
            INSERT INTO products (name, description, sku, barcode, category_id, supplier_id, cost_price, selling_price, stock_quantity, min_stock_level, unit)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            productData.name,
            productData.description,
            productData.sku,
            productData.barcode,
            productData.category_id,
            productData.supplier_id,
            productData.cost_price,
            productData.selling_price,
            productData.stock_quantity,
            productData.min_stock_level,
            productData.unit
        ]);
        
        res.status(201).json({ 
            id: result.insertId, 
            message: 'Produto criado com sucesso',
            product: productData
        });
    } catch (error) {
        console.error('Erro ao criar produto:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'SKU já existe' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Atualizar produto
app.put('/api/products/:id', async (req, res) => {
    const { 
        name, 
        description, 
        sku, 
        barcode, 
        category_id, 
        supplier_id, 
        cost_price, 
        selling_price, 
        min_stock_level, 
        unit 
    } = req.body;
    
    try {
        // Processar dados para evitar undefined
        const productData = {
            name: name,
            description: description || null,
            sku: sku,
            barcode: barcode || null,
            category_id: category_id || null,
            supplier_id: supplier_id || null,
            cost_price: parseFloat(cost_price),
            selling_price: parseFloat(selling_price),
            min_stock_level: parseInt(min_stock_level) || 0,
            unit: unit || 'un'
        };
        
        const [result] = await pool.execute(`
            UPDATE products 
            SET name = ?, description = ?, sku = ?, barcode = ?, category_id = ?, supplier_id = ?, 
                cost_price = ?, selling_price = ?, min_stock_level = ?, unit = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            productData.name,
            productData.description,
            productData.sku,
            productData.barcode,
            productData.category_id,
            productData.supplier_id,
            productData.cost_price,
            productData.selling_price,
            productData.min_stock_level,
            productData.unit,
            req.params.id
        ]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }
        
        res.json({ message: 'Produto atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        res.status(500).json({ error: error.message });
    }
});

// Produtos com estoque baixo
app.get('/api/products/low-stock', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.stock_quantity <= p.min_stock_level AND p.is_active = true
            ORDER BY p.stock_quantity ASC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar produtos com estoque baixo:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS DE VENDAS ==========

// Listar vendas
app.get('/api/sales', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT s.*, c.name as customer_name
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            ORDER BY s.sale_date DESC
            LIMIT 100
        `);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao listar vendas:', error);
        res.status(500).json({ error: error.message });
    }
});

// Detalhes de uma venda
app.get('/api/sales/:id', async (req, res) => {
    try {
        const [saleRows] = await pool.execute(`
            SELECT s.*, c.name as customer_name, c.email as customer_email
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            WHERE s.id = ?
        `, [req.params.id]);
        
        if (saleRows.length === 0) {
            return res.status(404).json({ error: 'Venda não encontrada' });
        }
        
        const [itemRows] = await pool.execute(`
            SELECT si.*, p.name as product_name, p.sku
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            WHERE si.sale_id = ?
        `, [req.params.id]);
        
        res.json({
            sale: saleRows[0],
            items: itemRows
        });
    } catch (error) {
        console.error('Erro ao buscar detalhes da venda:', error);
        res.status(500).json({ error: error.message });
    }
});

// Criar nova venda
app.post('/api/sales', async (req, res) => {
    const { customer_id, items, discount = 0, payment_method = 'cash', notes } = req.body;
    
    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Itens da venda são obrigatórios' });
    }
    
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Calcular total
        let total_amount = 0;
        for (const item of items) {
            if (!item.product_id || !item.quantity || !item.unit_price) {
                throw new Error('Todos os itens devem ter product_id, quantity e unit_price');
            }
            total_amount += parseFloat(item.quantity) * parseFloat(item.unit_price);
        }
        
        const final_amount = total_amount - parseFloat(discount);
        
        // Criar venda
        const [saleResult] = await connection.execute(`
            INSERT INTO sales (customer_id, total_amount, discount, final_amount, payment_method, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            customer_id || null, 
            total_amount, 
            parseFloat(discount), 
            final_amount, 
            payment_method, 
            notes || null
        ]);
        
        const saleId = saleResult.insertId;
        
        // Adicionar itens da venda e atualizar estoque
        for (const item of items) {
            const quantity = parseInt(item.quantity);
            const unit_price = parseFloat(item.unit_price);
            const total_price = quantity * unit_price;
            
            // Inserir item da venda
            await connection.execute(`
                INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?)
            `, [saleId, item.product_id, quantity, unit_price, total_price]);
            
            // Atualizar estoque
            await connection.execute(`
                UPDATE products 
                SET stock_quantity = stock_quantity - ? 
                WHERE id = ? AND stock_quantity >= ?
            `, [quantity, item.product_id, quantity]);
            
            // Registrar movimentação de estoque
            await connection.execute(`
                INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, reference_id, notes)
                VALUES (?, 'out', ?, 'sale', ?, 'Venda automatica')
            `, [item.product_id, quantity, saleId]);
        }
        
        await connection.commit();
        res.status(201).json({ 
            id: saleId, 
            message: 'Venda registrada com sucesso',
            total_amount: final_amount
        });
        
    } catch (error) {
        await connection.rollback();
        console.error('Erro ao criar venda:', error);
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// ========== ROTAS DE ESTOQUE ==========

// Ajustar estoque
app.post('/api/stock/adjust', async (req, res) => {
    const { product_id, quantity, notes } = req.body;
    
    if (!product_id || quantity === undefined || quantity === null) {
        return res.status(400).json({ error: 'product_id e quantity são obrigatórios' });
    }
    
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Buscar estoque atual
        const [currentStock] = await connection.execute(
            'SELECT stock_quantity FROM products WHERE id = ?', 
            [product_id]
        );
        
        if (currentStock.length === 0) {
            throw new Error('Produto não encontrado');
        }
        
        const oldQuantity = currentStock[0].stock_quantity;
        const newQuantity = parseInt(quantity);
        const difference = newQuantity - oldQuantity;
        
        // Atualizar estoque
        await connection.execute(`
            UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `, [newQuantity, product_id]);
        
        // Registrar movimentação
        await connection.execute(`
            INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, notes)
            VALUES (?, 'adjustment', ?, 'adjustment', ?)
        `, [product_id, difference, notes || null]);
        
        await connection.commit();
        res.json({ 
            message: 'Estoque ajustado com sucesso',
            old_quantity: oldQuantity,
            new_quantity: newQuantity,
            difference: difference
        });
        
    } catch (error) {
        await connection.rollback();
        console.error('Erro ao ajustar estoque:', error);
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// Histórico de movimentações
app.get('/api/stock/movements/:productId', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT sm.*, p.name as product_name
            FROM stock_movements sm
            JOIN products p ON sm.product_id = p.id
            WHERE sm.product_id = ?
            ORDER BY sm.created_at DESC
            LIMIT 50
        `, [req.params.productId]);
        
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar movimentações:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS DE RELATÓRIOS ==========

// Relatório de vendas por período
app.get('/api/reports/sales', async (req, res) => {
    const { start_date, end_date } = req.query;
    
    try {
        const [rows] = await pool.execute(`
            SELECT 
                DATE(sale_date) as date,
                COUNT(*) as total_sales,
                SUM(final_amount) as total_revenue,
                AVG(final_amount) as avg_sale_value
            FROM sales
            WHERE sale_date BETWEEN ? AND ?
            GROUP BY DATE(sale_date)
            ORDER BY date DESC
        `, [start_date, end_date]);
        
        res.json(rows);
    } catch (error) {
        console.error('Erro ao gerar relatório de vendas:', error);
        res.status(500).json({ error: error.message });
    }
});

// Produtos mais vendidos
app.get('/api/reports/top-products', async (req, res) => {
    const { days = 30 } = req.query;
    
    try {
        const [rows] = await pool.execute(`
            SELECT 
                p.name,
                p.sku,
                SUM(si.quantity) as total_sold,
                SUM(si.total_price) as total_revenue
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            JOIN sales s ON si.sale_id = s.id
            WHERE s.sale_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY p.id, p.name, p.sku
            ORDER BY total_sold DESC
            LIMIT 10
        `, [days]);
        
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar produtos mais vendidos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Dashboard - resumo geral
app.get('/api/dashboard', async (req, res) => {
    try {
        // Total de produtos
        const [productCount] = await pool.execute('SELECT COUNT(*) as count FROM products WHERE is_active = true');
        
        // Vendas hoje
        const [todaySales] = await pool.execute(`
            SELECT COUNT(*) as count, COALESCE(SUM(final_amount), 0) as revenue
            FROM sales WHERE DATE(sale_date) = CURDATE()
        `);
        
        // Produtos com estoque baixo
        const [lowStockCount] = await pool.execute(`
            SELECT COUNT(*) as count FROM products 
            WHERE stock_quantity <= min_stock_level AND is_active = true
        `);
        
        // Vendas últimos 7 dias
        const [weekSales] = await pool.execute(`
            SELECT COALESCE(SUM(final_amount), 0) as revenue
            FROM sales WHERE sale_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `);
        
        res.json({
            total_products: productCount[0].count,
            today_sales: todaySales[0].count,
            today_revenue: parseFloat(todaySales[0].revenue),
            low_stock_products: lowStockCount[0].count,
            week_revenue: parseFloat(weekSales[0].revenue)
        });
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS DE CATEGORIAS E FORNECEDORES ==========

// Listar categorias
app.get('/api/categories', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM categories ORDER BY name');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao listar categorias:', error);
        res.status(500).json({ error: error.message });
    }
});

// Listar fornecedores
app.get('/api/suppliers', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM suppliers ORDER BY name');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao listar fornecedores:', error);
        res.status(500).json({ error: error.message });
    }
});

// Listar clientes
app.get('/api/customers', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM customers ORDER BY name');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao listar clientes:', error);
        res.status(500).json({ error: error.message });
    }
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Algo deu errado!' });
});

// Rota de teste
app.get('/api/test', (req, res) => {
    res.json({ message: 'API funcionando!', timestamp: new Date().toISOString() });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`API disponível em http://localhost:${PORT}/api`);
    console.log(`Teste a API em http://localhost:${PORT}/api/test`);
});

module.exports = app;