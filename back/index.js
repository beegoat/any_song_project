import express from 'express';
import cors from 'cors';
import axios from 'axios';
import mysql from 'mysql2/promise'
import bodyParser from 'body-parser';

const app = express();
const port = 3001
const pool = mysql.createPool({
    host: "localhost",
    user: "deepal",
    password: "deepal",
    database: "anysong",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

const KEY = 'e35e27f252f8e4498dabac2591997ed0'
const GET_TOPTRACKS = `http://ws.audioscrobbler.com/2.0/?method=chart.gettoptracks&api_key=${KEY}&format=json`
const GET_TOPALBUMBYTAG = `http://ws.audioscrobbler.com/2.0/?method=tag.gettopalbums&tag=pop&api_key=${KEY}&format=json`
const GET_KOREATOPARTIST = `http://ws.audioscrobbler.com/2.0/?method=geo.gettopartists&country=koreatherepublicof&api_key=${KEY}&format=json`
const GET_ALBUMINFO = `http://ws.audioscrobbler.com//2.0/?method=album.getinfo&api_key=YOUR_API_KEY&artist=Cher&album=Believe&format=json`

app.use(cors());
app.use(express.json());

app.get('/', async (req, res) => {
    const [rows] = await pool.query(
        `
        SELECT a.id as id, title, artist, image_url 
        FROM album as a LEFT JOIN album_cover as b 
        ON a.id = b.id 
        ORDER BY a.id ASC
        `
        )
        res.json(rows)
        }
    );


app.get('/comment/:id', async(req, res) => {
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


app.post('/comment', async(req, res) => {
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

app.delete('/comment/:id', async(req, res) => {
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

app.put('/comment/:id', async(req, res) => {
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

app.get('/rating', async(req, res) => {
    const {user_id, album_id} = req.query;
    try{
    const [rows] = await pool.query(
            `
            SELECT 
            rate
            FROM album_rating
            WHERE user_id = ? AND album_id = ?
            `
        , [user_id, album_id])
        if(rows){
            res.send(rows);
        }
    } catch (e) {
        console.error(e);
    } 
    
})

app.post('/rating', async(req, res) => {
    const {rate, user_id, album_id} = req.body.data;

    try{
        const [rows] = await pool.query(
            `
            SELECT 
            rate
            FROM album_rating
            WHERE user_id = ? AND album_id = ?
            `
            , [user_id, album_id])
        if(rows.length!==0){
                await pool.query(
                    `
                    UPDATE album_rating 
                    SET rate = ?
                    WHERE user_id = ? AND album_id = ?
                    `
                , [rate, user_id, album_id])
        } else {
                await pool.query(
                    `
                    INSERT INTO album_rating
                    SET rate = ?,
                    user_id = ?,
                    album_id = ?
                    `
                , [ rate, user_id, album_id]
                )
        } 
    } catch (e) {
        console.error(e)
    } finally {
        const [rows] = await pool.query(
            `
            SELECT 
            rate
            FROM album_rating
            WHERE user_id = ? AND album_id = ?
            `
            , [user_id, album_id])
        res.json(rows)
    }
})

app.delete('/rating', async(req, res) => {
    const {user_id, album_id} = req.body
    console.log(user_id, album_id);
    try{
    await pool.query(
        `
        DELETE FROM album_rating
        WHERE user_id = ? AND album_id = ?
        `
        ,[ user_id, album_id ])
    console.log("delete done.")
    } catch (e) {
        console.error(e)
    } 
})

app.get('/board/total', async(req, res) => {
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

 app.get('/board/songreview', async(req, res) => {
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

 app.get('/board/albumreview', async(req, res) => {
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

 app.get('/board/talk', async(req, res) => {
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

 app.get('/board/question', async(req, res) => {
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

 app.get('/board/:id', async(req, res) => {
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

  app.post('/board', async(req, res) => {
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

  app.delete('/board/:id', async(req, res) => {
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

app.put('/board/:id', async(req, res) => {
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

app.post('/board/comment/:id', async(req, res) => {
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

app.delete('/board/comment/:id', async(req, res) => {
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

app.put('/board/comment/:id', async(req, res) => {
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


app.post('/user', async(req, res) =>{
    const { id, password, nickname } = req.body
    const introduction = "안녕하세요 " + nickname + "입니다."
    try{
        await pool.query(
            `
            INSERT INTO users
            SET id = ?,
            password = ?,
            nickname = ?,
            introduction = ?,
            created_date = NOW()
            `
            , [id, password, nickname, introduction])
        res.json(200)
        } catch(e) {
            console.error(e)
    }

})

app.post('/login', async(req, res) => {
    const { id, password } = req.body
    try{ 
        const [rows] =  await pool.query(
            `
            SELECT *
            FROM users
            WHERE id = ?
            `, [id]
        )
        if(rows){
            const [passRows] = await pool.query(
                `
                SELECT *
                FROM users
                WHERE id = ? AND password = ?
                `, [id, password]
            )
            if(rows === passRows) {
                res.json(200)
            } else {
                res.json("비밀번호 불일치")
            }
        } else {
            res.json("해당하는 아이디가 없습니다.")
        }
    } catch(e) {
        console.error(e)
    }
})

//아래는 안쓰는 것




app.get("/hello", (req, res) => {
    const getData = async () => {
        try{
            const response = await axios.get(GET_TOPALBUMBYTAG, {});
            res.send(response.data);
        } catch (e) {
            console.error(e);
        }
    }
    getData();
  });


app.post("/album", (req, res) => {
    const getAlbumData = async () => {
        try {
            const response = await axios.get(GET_TOPALBUMBYTAG, {})
            for(let i=0; i<(response.data.albums.album).length; i++){
                const album_title = response.data.albums.album[i].name;
                const album_artist = response.data.albums.album[i].artist.name;
                pool.query(`
                UPDATE album SET
                title = ?,
                artist = ?
                WHERE 
                id = ?
            `,[album_title, album_artist, (i+1)])
            }
        } catch (e) {
            console.error(e);
        } finally {
            res.send("done.")
        }
    }
    getAlbumData();
})

app.delete("/albumcover", (req,res) => {
    const getAlbumCover = async() => {
        try{
            const response = await axios.get(GET_TOPALBUMBYTAG, {})
            for(let i=51; i<90; i++){
                pool.query(
                    `
                    delete from album 
                    WHERE id = ?
                    `,[i])
            }
        } catch(e) {
            console.error(e)
        } finally {
            console.log("done.")
        }
    }
    getAlbumCover()
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})