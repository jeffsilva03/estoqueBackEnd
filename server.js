// server.js - Versão corrigida para Railway
const path = require('path');
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

// Middleware para logs de requisições
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Configuração do banco de dados MySQL
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'inventory_system',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
};

const pool = mysql.createPool(dbConfig);

// Teste de conexão
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Conectado ao banco de dados MySQL');
        connection.release();
    } catch (error) {
        console.error('❌ Erro ao conectar ao banco:', error);
    }
}

testConnection();

// Middleware de autenticação
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

// Produtos com estoque baixo
app.get('/api/products/low-stock', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT p.*, c.name as category_name, s.name as supplier_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.stock_quantity <= p.min_stock_level AND p.is_active = true
            ORDER BY p.stock_quantity ASC
        `);
        res.json(rows || []);
    } catch (error) {
        console.error('Erro ao buscar produtos com estoque baixo:', error);
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
    try {
        const { 
            name, 
            sku, 
            cost_price, 
            selling_price, 
            stock_quantity = 0, 
            min_stock_level = 0, 
            description = null,
            category_id = null,
            supplier_id = null,
            barcode = null,
            unit = 'un'
        } = req.body;

        // Validação de campos obrigatórios
        if (!name || !sku || !cost_price || !selling_price) {
            return res.status(400).json({ 
                error: 'Campos obrigatórios: name, sku, cost_price, selling_price' 
            });
        }

        // Validação de tipos
        if (isNaN(cost_price) || isNaN(selling_price)) {
            return res.status(400).json({ 
                error: 'cost_price e selling_price devem ser números válidos' 
            });
        }

        // Verificar se SKU já existe
        const [existingSku] = await pool.execute('SELECT id FROM products WHERE sku = ?', [sku]);
        if (existingSku.length > 0) {
            return res.status(400).json({ 
                error: 'SKU já existe. Use um SKU único.' 
            });
        }

        const [result] = await pool.execute(`
            INSERT INTO products (
                name, sku, description, cost_price, selling_price, 
                stock_quantity, min_stock_level, category_id, supplier_id, 
                barcode, unit, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
            name, 
            sku, 
            description, 
            parseFloat(cost_price), 
            parseFloat(selling_price),
            parseInt(stock_quantity) || 0,
            parseInt(min_stock_level) || 0,
            category_id,
            supplier_id,
            barcode,
            unit
        ]);

        const [newProduct] = await pool.execute('SELECT * FROM products WHERE id = ?', [result.insertId]);
        
        res.status(201).json({
            message: 'Produto criado com sucesso',
            id: result.insertId,
            product: newProduct[0]
        });

    } catch (error) {
        console.error('Erro ao criar produto:', error);
        res.status(500).json({ error: 'Erro interno do servidor: ' + error.message });
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
        const [result] = await pool.execute(`
            UPDATE products 
            SET name = ?, description = ?, sku = ?, barcode = ?, category_id = ?, supplier_id = ?, 
                cost_price = ?, selling_price = ?, min_stock_level = ?, unit = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            name,
            description || null,
            sku,
            barcode || null,
            category_id || null,
            supplier_id || null,
            parseFloat(cost_price),
            parseFloat(selling_price),
            parseInt(min_stock_level) || 0,
            unit || 'un',
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
    const connection = await pool.getConnection();
    
    try {
        const { 
            customer_name = null, 
            payment_method, 
            discount = 0, 
            notes = null, 
            items 
        } = req.body;

        // Validação de campos obrigatórios
        if (!payment_method) {
            return res.status(400).json({ 
                error: 'Campo obrigatório: payment_method' 
            });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ 
                error: 'Itens da venda são obrigatórios e devem ser um array não vazio' 
            });
        }

        // Validar cada item
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item.product_id || !item.quantity || !item.unit_price) {
                return res.status(400).json({ 
                    error: `Item ${i + 1}: product_id, quantity e unit_price são obrigatórios` 
                });
            }

            if (isNaN(item.quantity) || isNaN(item.unit_price)) {
                return res.status(400).json({ 
                    error: `Item ${i + 1}: quantity e unit_price devem ser números válidos` 
                });
            }

            // Verificar se o produto existe e tem estoque suficiente
            const [product] = await connection.execute('SELECT * FROM products WHERE id = ?', [item.product_id]);
            if (product.length === 0) {
                return res.status(400).json({ 
                    error: `Produto com ID ${item.product_id} não encontrado` 
                });
            }

            if (product[0].stock_quantity < item.quantity) {
                return res.status(400).json({ 
                    error: `Estoque insuficiente para o produto "${product[0].name}". Disponível: ${product[0].stock_quantity}, Solicitado: ${item.quantity}` 
                });
            }
        }

        // Calcular totais
        let subtotal = 0;
        for (const item of items) {
            subtotal += parseFloat(item.unit_price) * parseInt(item.quantity);
        }

        const discountAmount = parseFloat(discount) || 0;
        const finalAmount = subtotal - discountAmount;

        // Iniciar transação
        await connection.beginTransaction();

        // Criar a venda
        const [saleResult] = await connection.execute(`
            INSERT INTO sales (
                customer_name, payment_method, subtotal, discount, 
                final_amount, notes, sale_date, status
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'completed')
        `, [
            customer_name, 
            payment_method, 
            subtotal, 
            discountAmount, 
            finalAmount, 
            notes
        ]);

        const saleId = saleResult.insertId;

        // Inserir itens da venda e atualizar estoque
        for (const item of items) {
            // Inserir item da venda
            await connection.execute(`
                INSERT INTO sale_items (
                    sale_id, product_id, quantity, unit_price, total_price
                ) VALUES (?, ?, ?, ?, ?)
            `, [
                saleId, 
                item.product_id, 
                item.quantity, 
                item.unit_price, 
                parseFloat(item.unit_price) * parseInt(item.quantity)
            ]);

            // Atualizar estoque
            await connection.execute(`
                UPDATE products 
                SET stock_quantity = stock_quantity - ?, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [item.quantity, item.product_id]);
        }

        await connection.commit();

        res.status(201).json({
            message: 'Venda criada com sucesso',
            id: saleId,
            subtotal: subtotal,
            discount: discountAmount,
            total_amount: finalAmount
        });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao criar venda:', error);
        res.status(500).json({ error: 'Erro interno do servidor: ' + error.message });
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
    try {
        const { 
            start_date = null, 
            end_date = null, 
            limit = 50 
        } = req.query;

        let query = `
            SELECT 
                s.*,
                COUNT(si.id) as total_items
            FROM sales s
            LEFT JOIN sale_items si ON s.id = si.sale_id
        `;

        let params = [];
        let whereConditions = [];

        if (start_date && start_date !== 'undefined' && start_date !== 'null') {
            whereConditions.push('DATE(s.sale_date) >= DATE(?)');
            params.push(start_date);
        }

        if (end_date && end_date !== 'undefined' && end_date !== 'null') {
            whereConditions.push('DATE(s.sale_date) <= DATE(?)');
            params.push(end_date);
        }

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        query += `
            GROUP BY s.id
            ORDER BY s.sale_date DESC
            LIMIT ?
        `;

        params.push(parseInt(limit) || 50);

        const [sales] = await pool.execute(query, params);

        // Calcular estatísticas
        let statsQuery = `
            SELECT 
                COUNT(*) as total_sales,
                COALESCE(SUM(final_amount), 0) as total_revenue,
                COALESCE(AVG(final_amount), 0) as average_sale
            FROM sales s
        `;

        if (whereConditions.length > 0) {
            statsQuery += ' WHERE ' + whereConditions.join(' AND ');
        }

        const statsParams = params.slice(0, -1);
        const [stats] = await pool.execute(statsQuery, statsParams);

        res.json({
            sales: sales || [],
            statistics: {
                total_sales: stats[0].total_sales || 0,
                total_revenue: parseFloat(stats[0].total_revenue) || 0,
                average_sale: parseFloat(stats[0].average_sale) || 0
            }
        });

    } catch (error) {
        console.error('Erro ao gerar relatório de vendas:', error);
        res.status(500).json({ error: 'Erro interno do servidor: ' + error.message });
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

// Servir arquivos estáticos
app.use(express.static('public'));

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota de teste
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'API funcionando corretamente!', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err);
    res.status(500).json({ 
        error: 'Erro interno do servidor', 
        message: err.message 
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📡 API disponível em http://localhost:${PORT}/`);
    console.log(`🧪 Teste a API em http://localhost:${PORT}/api/test`);
});

module.exports = app;
