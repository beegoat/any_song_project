import express from 'express';
 
export const commentRouter = express.Router();
 
commentRouter.get('/comment/:id', async(req, res) => {
    const id = req.params.id
    try{
        const [rows] = await pool.query(
            `
            SELECT 
            c.id as comment_id, a.id as album_id, content, (select nickname from users as u where c.user_id = u.id) as nickname, DATE_FORMAT(create_date, '%m월 %d일') as create_date
            FROM comment AS c LEFT JOIN album AS a ON c.album_id = a.id 
            WHERE a.id = ? AND delete_date IS NULL
            `, [id]
        )
        res.json(rows)
    } catch (e) {
        console.error(e);
    }
})


commentRouter.post('/comment', async(req, res) => {
    const {album_id, user_id, content} = req.body;
    try { 
        await pool.query(
        `
        INSERT INTO comment 
        SET content = ?,
        user_id = ?,
        album_id = ?, 
        create_date = NOW()
        `, [content, user_id, album_id])

        const [rows] = await pool.query(
            `
            SELECT 
            c.id as comment_id, a.id as album_id, content, (select nickname from users as u where c.user_id = u.id) as nickname, DATE_FORMAT(create_date, '%m월 %d일') as create_date
            FROM comment AS c LEFT JOIN album AS a ON c.album_id = a.id 
            WHERE a.id = ? AND delete_date IS NULL
            `, [album_id]
        )
        res.json(rows)
    } catch(e) {
        console.error(e);
    }
})

commentRouter.delete('/comment/:id', async(req, res) => {
    const id = req.params.id;
    const {album_id} = req.body
    try{
        await pool.query(
            `
            UPDATE comment
            SET delete_date = NOW()
            WHERE id = ?
            `, [id]
        )
        const [rows] = await pool.query(
            `
            SELECT 
            c.id as comment_id, a.id as album_id, content, (select nickname from users as u where c.user_id = u.id) as nickname, DATE_FORMAT(create_date, '%m월 %d일') as create_date
            FROM comment AS c LEFT JOIN album AS a ON c.album_id = a.id 
            WHERE a.id = ? AND delete_date IS NULL
            `, [album_id]
        )
        res.json(rows)
    } catch (e) {
        console.error(e);
    }
})

commentRouter.put('/comment/:id', async(req, res) => {
    const id = req.params.id;
    const {album_id, content} = req.body.data
    try{
        await pool.query(
            `
            UPDATE comment
            SET content = ?,
            modified_date = NOW()
            WHERE id = ?
            `, [content, id]
        )
        const [rows] = await pool.query(
            `
            SELECT 
            c.id as comment_id, a.id as album_id, content, (select nickname from users as u where c.user_id = u.id) as nickname, DATE_FORMAT(create_date, '%m월 %d일') as create_date
            FROM comment AS c LEFT JOIN album AS a ON c.album_id = a.id 
            WHERE a.id = ? AND delete_date IS NULL
            `, [album_id]
        )
        res.json(rows)
    } catch (e) {
        console.error(e);
    }
})
