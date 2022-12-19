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
app.use(bodyParser.json())

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