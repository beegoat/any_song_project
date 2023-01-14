import express from 'express';

export const boardRouter = express.Router();

boardRouter.get('/board/total', async(req, res) => {
    try{
        const [rows] = await pool.query(
            `
            SELECT bc.name, b.id, b.subject, (select nickname from users as u where b.user_id = u.id) as nickname, date_format(b.created_date, '%m/%d') as created_date, hits
            FROM board as b LEFT JOIN board_category as bc ON b.category = bc.id
            `
        )
        res.json(rows);
    } catch(e) {
        console.error(e)
    }
 })

 boardRouter.get('/board/songreview', async(req, res) => {
    try{
        const [rows] = await pool.query(
            `
            SELECT bc.name, b.id, b.subject, (select nickname from users as u where b.user_id = u.id) as nickname, date_format(b.created_date, '%m/%d') as created_date, hits
            FROM board as b LEFT JOIN board_category as bc ON b.category = bc.id WHERE bc.id = 1;
            `
        )
        res.json(rows);
    } catch(e) {
        console.error(e)
    }
 })

 boardRouter.get('/board/albumreview', async(req, res) => {
    try{
        const [rows] = await pool.query(
            `
            SELECT bc.name, b.id, b.subject, (select nickname from users as u where b.user_id = u.id) as nickname, date_format(b.created_date, '%m/%d') as created_date, hits
            FROM board as b LEFT JOIN board_category as bc ON b.category = bc.id WHERE bc.id = 2;
            `
        )
        res.json(rows);
    } catch(e) {
        console.error(e)
    }
 })

 boardRouter.get('/board/talk', async(req, res) => {
    try{
        const [rows] = await pool.query(
            `
            SELECT bc.name, b.id, b.subject, (select nickname from users as u where b.user_id = u.id) as nickname, date_format(b.created_date, '%m/%d') as created_date, hits
            FROM board as b LEFT JOIN board_category as bc ON b.category = bc.id WHERE bc.id = 3;
            `
        )
        res.json(rows);
    } catch(e) {
        console.error(e)
    }
 })

 boardRouter.get('/board/question', async(req, res) => {
    try{
        const [rows] = await pool.query(
            `
            SELECT bc.name, b.id, b.subject, (select nickname from users as u where b.user_id = u.id) as nickname, date_format(b.created_date, '%m/%d') as created_date, hits
            FROM board as b LEFT JOIN board_category as bc ON b.category = bc.id WHERE bc.id = 4;
            `
        )
        res.json(rows);
    } catch(e) {
        console.error(e)
    }
 })

 boardRouter.get('/board/:id', async(req, res) => {
    const id = req.params.id
    try{

        const [rows] = await pool.query(
            `
            SELECT b.id, b.subject, b.content, 
            (SELECT nickname FROM users AS u WHERE b.user_id = u.id) AS nickname, 
            date_format(b.created_date, '%m/%d') AS created_date, bc.content AS comment_content, 
            (SELECT nickname FROM users AS u WHERE bc.user_id = u.id) AS comment_name, 
            date_format(bc.created_date, '%m/%d') AS c_created_date, bc.liked, bc.id as comment_id, b.category
            FROM board AS b LEFT JOIN board_comment AS bc ON b.id = bc.board_id 
            WHERE b.id = ?
            `, [id]
        )
        
        await pool.query(
            `
            UPDATE board
            SET hits = hits + 1
            WHERE id = ?
            `, [id]
        )

        // console.log(rows)
        res.json(rows)
    } catch(e) {
        console.error(e);
    }
  })

  boardRouter.post('/board', async(req, res) => {
    const {subject, content, user_id, category} = req.body;
    try{
        await pool.query(
            `
            INSERT INTO board
            SET subject = ?,
            content = ?,
            user_id = ?,
            category = ?, 
            created_date = NOW()
            `, [subject, content, user_id, category]
        )
        // 글 작성 뒤, 해당 글 상세페이지로 이동하기 위해서 아이디로 작성한 글 중에 가장 id가 큰 값 1개만 가져와서 값 넘겨주기.. 클 수록 최근이기 때문에
        const response = await pool.query(
            `
            SELECT id 
            FROM board 
            WHERE user_id = ? ORDER BY id DESC LIMIT 1
            `, [user_id]
        )
        res.json(response)
        
    } catch (e) {
        console.error(e)
    }
  })

  boardRouter.delete('/board/:id', async(req, res) => {
    const id = req.params.id;
    try{
        const response = await pool.query(
            `
            DELETE FROM board
            WHERE id = ?
            `, [id]
        )
        res.json(response)
    } catch(e) {
        console.error(e)
    }

})

boardRouter.put('/board/:id', async(req, res) => {
    const id = req.params.id;
    const {subject, content, user_id, category} = req.body
    try{
            await pool.query(
            `
            UPDATE board SET
            subject = ?,
            content = ?,
            category = ?,
            modified_date = NOW()
            WHERE 
            id = ?
            `, [subject, content, category, id])
            const response = await pool.query(
            `
            SELECT bc.id 
            FROM board AS b LEFT JOIN board_category bc ON b.category = bc.id where b.id = ?;
            `, [id]
            )
            
            res.json(response)
    } catch(e) {
        console.error(e)
    }
})

boardRouter.post('/board/comment/:id', async(req, res) => {
    const id = req.params.id;
    const { content, user_id } = req.body
    try{
        await pool.query(
            `
            INSERT INTO board_comment
            SET content = ?,
            user_id = ?,
            created_date = NOW(),
            board_id = ?
            `, [content, user_id, id]
        )
        const response = await pool.query(
            `
            SELECT bc.content AS comment_content, 
            (SELECT nickname FROM users AS u WHERE bc.user_id = u.id) AS comment_name, date_format(bc.created_date, '%m %d') AS c_created_date, bc.id as comment_id, bc.board_id as id
            FROM board_comment AS bc
            WHERE bc.board_id = ?
            `, [id]
        )
        res.json(response)
    } catch(e) {
        console.error(e)
    }
})

boardRouter.delete('/board/comment/:id', async(req, res) => {
    const id = req.params.id;
    const { board_id } = req.body
    try {
        await pool.query(
            `
            DELETE FROM board_comment
            WHERE id = ?
            `, [id]
        )
        const response = await pool.query(
            `
            SELECT bc.content AS comment_content, 
            (SELECT nickname FROM users AS u WHERE bc.user_id = u.id) AS comment_name, date_format(bc.created_date, '%m %d') AS c_created_date, bc.id as comment_id
            FROM board_comment AS bc
            WHERE bc.board_id = ?
            `, [board_id]
        )
        res.json(response)
    } catch(e) {
        console.error(e)
    }
})

boardRouter.put('/board/comment/:id', async(req, res) => {
    const id = req.params.id;
    const { content, user_id, board_id } = req.body
    console.log(id, content, user_id, board_id)
    try{
        await pool.query(
            `
            UPDATE board_comment SET
            content = ?,
            modified_date = NOW()
            WHERE 
            id = ?
            `, [content, id]     
        )
        const response = await pool.query(
            `
            SELECT bc.content AS comment_content, 
            (SELECT nickname FROM users AS u WHERE bc.user_id = u.id) AS comment_name, date_format(bc.created_date, '%m %d') AS c_created_date, bc.id as comment_id
            FROM board_comment AS bc
            WHERE bc.board_id = ?
            `, [board_id]
        )
        res.json(response)
    } catch(e) {
        console.error(e)
    }
})
