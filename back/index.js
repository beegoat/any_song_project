import express from 'express';
import cors from 'cors';
import axios from 'axios';
import mysql from 'mysql2/promise'
import bodyParser from 'body-parser';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';


const app = express();
const port = 3001
const pool = mysql.createPool({
    // host: "localhost",
    host: "43.201.140.172",
    user: "deepal",
    password: "deepal",
    database: "anysong",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

const saltRounds = 10;
const ACCESS_SECRET = "sanjoozzang"
const REFRESH_SECRET = "sanjoozzang2"

const API_KEY = "e35e27f252f8e4498dabac2591997ed0"
const GET_TOP_TRACKS ="https://ws.audioscrobbler.com/2.0/?method=chart.gettoptracks&api_key=e35e27f252f8e4498dabac2591997ed0&format=json"


app.use(cors({
    origin : [
        "localhost:3000",
        "http://localhost:3000",
        "http://43.201.140.172",
        "http://43.201.140.172:3000",
        "43.201.140.172",
        "43.201.140.172:3000",
        "http://deepal.site"
    ],
    credentials: true
  }));
app.use(express.json());
app.use(cookieParser())

// axios.defaults.withCredentials = true;

//토큰 값 비교하여 권한을 부여하는 함수
const jwtMiddleware = async (req, res, next) => {
    // 쿠키 내부에 저장된 토큰을 가져온다.
    let token = req.cookies.accessToken;
    if(!token){
        return res.status(400)
    } else {
  
    jwt.verify(token, ACCESS_SECRET , async (err, decoded) => {
      if (err) return res.json({ isAuth: false, message: "token decode 실패" });
  
    // 토큰을 복호화한 후 유저를 찾는다. (token 생성시 _id값을 주었음)
      const user = await pool.query(
        `
        SELECT id, nickname, isAdmin, introduction
        FROM users
        WHERE id = ?
        `, [decoded.userID]
      )
      if(!user){
        return res.json({
            isAuth: false,
            message:
              "백단 token 복호화에는 성공했으나 해당 User를 찾는데 실패했습니다. 로그아웃하셨군요",
        })}
      
    //   // 다음 컨트롤러에서 req를 빼다 쓰기 위해 저장
      req.token = token;
      req.user = user;
      next();
    });
}
  };

app.post('/user', async(req, res) =>{
    const { id, nickname } = req.body;
    let { password } = req.body;


    // 솔트 = 10번 치고 해쉬화 
    bcrypt.genSalt(saltRounds, async function(err, salt){
        if(err){
            return res.status(500).json({
                registerSuccess: false,
                message: "비밀번호 해쉬화 실패."
            });
        }
        bcrypt.hash(password, salt, async function(err, hashedPassword){
            if(err){
                return res.status(500).json({
                    registerSuccess: false,
                    message: "비밀번호 해쉬화 실패."
                })
            }
            password = hashedPassword ;
            const introduction = "안녕하세요 " + nickname + "입니다.";
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
        })
})

// 아이디, 닉네임 중복확인 API
app.get('/sameid', async(req, res) => {
    const {id} = req.query
    try{
        const [rows] = await pool.query(
            `
            SELECT id
            FROM users
            WHERE id = ?
            `, [id]
        )
        if(rows.length){
            return res.json({code: 400, message : "중복된 아이디가 있습니다."})
        } else {
            return res.json({code: 200, message : "사용가능합니다."})
        }
    } catch(e) {
        console.error(e)
    }
})

app.get('/samenickname', async(req, res) => {
    const { nickname } = req.query
    try{
        const [rows] = await pool.query(
            `
            SELECT nickname
            FROM users
            WHERE nickname = ?
            `, [nickname]
        )
        if(rows.length){
            return res.json({code: 400, message : "중복된 닉네임이 있습니다."})
        } else {
            return res.json({code: 200, message : "사용가능합니다."})
        }
    } catch(e) {
        console.error(e)
    }
})


// 로그인 하면 access, refresh Token 발급하여 쿠키에 담아 보냄.
app.post('/login', async(req, res) => {
    const { id, password } = req.body
    try{ 
        const [rows] =  await pool.query(
            `
            SELECT *
            FROM users
            WHERE id = ? AND deleted_date is NULL
            `, [id]
        )
        // 조회하여 해당 아이디가 있으면 비밀번호를 확인
        if(rows){
            bcrypt.compare(password, rows[0].password, async(error, isMatch) => {
                if(error){
                    return res.status(500).json({ error: "비밀번호 오류" });
                }
                if (isMatch) {
                    const accessToken = jwt.sign({ userID: id, isAdmin:rows[0].isAdmin }, ACCESS_SECRET, {expiresIn: '30m'});
                    const refreshToken = jwt.sign({ userID: id, isAdmin:rows[0].isAdmin }, REFRESH_SECRET, {expiresIn: '7d'});
                    await pool.query(
                        `
                        UPDATE users 
                        SET token = ?
                        WHERE id = ?
                        `, [accessToken, id]
                    )
                    res.cookie('accessToken', accessToken, {
                      httpOnly: true,
                      sameSite: 'none',
                      secure: true
                    })

                    res.cookie('refreshToken', refreshToken, {
                        httpOnly: true,
                        sameSite: 'none',
                        secure: true
                    })
                    
                    res.status(200).json('success');
                } else {
                    return res.status(403).json({
                      loginSuccess: false,
                      message: "비밀번호가 틀렸습니다.",
                })
            }})
        } else {
            res.json("해당하는 아이디가 없습니다.")
        }
    } catch(e) {
        console.error(e)
    }
}, )


app.post('/jwtauthcheck', jwtMiddleware,  async(req, res) => {
    if (!req.user){ 
        return res.json({ isAuth: false });
    }
  // 유저가 있다는 이야기니 인증 처리
    return res.json({
        isAuth: true,
        user: req.user[0][0].id,
        nickname: req.user[0][0].nickname,
        isAdmin: req.user[0][0].isAdmin,
        introduction: req.user[0][0].introduction
     });
});

app.get('/logout', jwtMiddleware, async(req, res) => {
    try{
        res.cookie('accessToken', '');
        res.status(200).json("success")
    } catch(e) {
        res.status(500).json(error)
    }
})

// Nav 음악검색

app.get('/musicsearch', async(req, res) => {
    let songInfo = []
    let songInfoComplete = []
    
    const { searchWord } = req.query
    
    try{
        const getAlbumInfo = async() => {
            try{
            const response = await axios.get(`http://ws.audioscrobbler.com/2.0/?method=track.search&track=${searchWord}&api_key=${API_KEY}&format=json&limit=5`, {})
            
            if(response.data.results.trackmatches !== undefined || response.data.results.trackmatches){
                await response.data.results.trackmatches.track.map((song) =>{
                    if(song.name && song.artist){
                    songInfo.push({ song : song.name, artist : song.artist })
                    } 
                })
            } else {
                return "stop"
            }
            } catch(e) {
                console.error(e)
            } 
        }
    
        const getAlbumCover = async() => {
            let i = 0
            try{
            while(i<5){
                const getMusicCover = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${API_KEY}&artist=${songInfo[i].artist}&track=${songInfo[i].song}&format=json`)
                if(getMusicCover.data.track.album !== undefined ){
                    songInfoComplete.push({song : songInfo[i].song, artist: songInfo[i].artist, image_url: getMusicCover.data.track.album.image[2]['#text']})
                } else {
                    songInfoComplete.push({song : songInfo[i].song, artist: songInfo[i].artist})
                }
                i++;
            }
            } catch(e) {
                console.error(e)
            }
        }
        

        const getAlbumComplete = async() => {
            const response = await getAlbumInfo();
            if(response !== "stop") {
                await getAlbumCover();
                res.json(songInfoComplete)
            }
           
        }

        getAlbumComplete();
        
    } catch(e) {
        console.error(e)
    }
})

app.get('/searchinfo', async(req, res) => {
    const { artist, song } = req.query
    
    let musicInfo = []

    try{
    const response = await axios.get(`http://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${API_KEY}&artist=${artist}&track=${song}&format=json`)
    const info = response.data.track
    musicInfo.push({songTitle : info.name, songArtist: info.artist.name, artistInfo : info.artist.url, albumTitle : info.album.title, albumCover : info.album.image[3]['#text'], songTags : info.toptags.tag, publishedDate : info.wiki.published, songIntroduction : info.wiki.content})
    res.json(musicInfo)
    } catch(e) {
        console.error(e)
    }

})
// Mypage 관련 함수

app.get('/myalbuminfo', jwtMiddleware, async(req, res) => {
    const user = req.user[0][0].id
    try{
        const response = await pool.query(
            `
            SELECT (SELECT image_url FROM album_cover AS ac WHERE a.id = ac.album_id) AS img,
            a.title AS title, a.artist AS artist, ar.rate AS rate, ar.user_id 
            FROM album_rating AS ar LEFT JOIN album AS a ON ar.album_id = a.id 
            WHERE ar.user_id = ?
            `, [user]
            )
        return res.json(response)
    } catch(e) {
        console.error(e);
    }
})

app.get('/mysonginfo', jwtMiddleware, async(req, res) => {
    const user = req.user[0][0].id
    try{
        const response = await pool.query(
            `
            SELECT (SELECT image_url FROM songs_cover sc WHERE s.id = sc.songs_id) AS img, 
            s.title AS title, s.artist AS artist, sr.rate AS rate, sr.user_id  
            FROM songs_rating AS sr LEFT JOIN songs AS s on sr.song_id = s.id WHERE sr.user_id = ?
            `, [user]
        )
        return res.json(response)
    } catch(e) {
        console.error(e)
    }
})

app.get('/myarticleinfo', jwtMiddleware, async(req, res) => {
    const user = req.user[0][0].id
    try{
        const response = await pool.query(
            `
            SELECT id, category, subject, DATE_FORMAT(created_date, '%m/%d') as date, hits 
            FROM board WHERE user_id = ?
            `, [user]
        )
        return res.json(response)
    } catch(e) {
        console.error(e)
    }
})

app.put('/mynickname', jwtMiddleware, async(req, res) => {
    const { nickname } = req.body
    const user = req.user[0][0].id
    try {
        await pool.query(
            `
            UPDATE users 
            SET nickname = ?
            WHERE id = ?
            `, [nickname, user]
        )
        res.json("success")
    } catch(e) {
        console.error(e)
    }
})

app.put('/myintroduction', jwtMiddleware, async(req, res) => {
    const { introduction } = req.body
    const user = req.user[0][0].id
    try {
        await pool.query(
            `
            UPDATE users
            SET introduction = ?
            WHERE id = ?
            `, [introduction, user]
        )
        res.json("success")
    } catch(e) {
        console.error(e)
    }
})

app.post('/comparepw', jwtMiddleware, async(req, res) =>{

    const user = req.user[0][0].id
    const { password } = req.body
    const [rows] =  await pool.query(
        `
        SELECT *
        FROM users
        WHERE id = ?
        `, [user]
    )
    console.log(rows)
    if(rows){
        bcrypt.compare(password, rows[0].password, async(error, isMatch)=> {
        if(error){
            console.log("error")
        }
        if(isMatch){
            console.log("match")
            return res.json({ status:200, message: "비밀번호가 일치합니다."})
        } else {
            return res.json({ status:500,  message: "비밀번호가 일치하지 않습니다." });
        }
    })
    } else {
        return res.json({status:500, message: "알 수 없는 오류가 발생했습니다."})
    }
})

app.put('/mypassword', jwtMiddleware, async(req, res) =>{
    let { password } = req.body;
    const user = req.user[0][0].id

    bcrypt.genSalt(saltRounds, async function(err, salt){
        if(err){
            return res.status(500).json({
                registerSuccess: false,
                message: "비밀번호 해쉬화 실패."
            });
        }
        bcrypt.hash(password, salt, async function(err, hashedPassword){
            if(err){
                return res.status(500).json({
                    registerSuccess: false,
                    message: "비밀번호 해쉬화 실패."
                })
            }
            password = hashedPassword ;
            
            try{
                await pool.query(
                    `
                    UPDATE users
                    SET password = ?
                    WHERE id = ?
                    `
                    , [password, user])
                res.json("success")
                } catch(e) {
                    console.error(e)
                }
            })
        })
})

app.put('/withdraw', jwtMiddleware, async(req, res) =>{
    const user = req.user[0][0].id
    try{
        await pool.query(
            `
            UPDATE users
            SET deleted_date = NOW()
            WHERE id = ?
            `, [user]
        )
        res.status(200).json("success")
    } catch(e) {
        console.error(e)
    }
})
// 별점평가

app.get('/songs', async(req, res) => {
    const [rows] = await pool.query(
        `
        SELECT s.id as id, title, artist, image_url
        FROM songs as s LEFT JOIN songs_cover as sc
        ON s.id = sc.songs_id
        ORDER BY s.id ASC
        `
    )
    res.json(rows)
});

app.get('/albums', async(req, res) => {
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
    const {isSong, isAlbum} = req.query
    try{
        if(isAlbum === "true"){
        const [rows] = await pool.query(
            `
            SELECT 
            c.id as comment_id, a.id as id, content, (select nickname from users as u where c.user_id = u.id) as nickname, (select id from users as u where c.user_id = u.id) as user_id, DATE_FORMAT(create_date, '%m월 %d일') as create_date
            FROM comment AS c LEFT JOIN album AS a ON c.album_id = a.id 
            WHERE a.id = ? AND delete_date IS NULL AND c.album_id IS NOT NULL
            `, [id]
        )
        return res.json(rows)
    } else if(isSong === "true"){
        const [rows] = await pool.query(
            `
            SELECT 
            c.id as comment_id, s.id as id, content, 
            (select nickname from users as u where c.user_id = u.id) as nickname, (select id from users as u where c.user_id = u.id) as user_id, 
            DATE_FORMAT(create_date, '%m월 %d일') as create_date
            FROM comment AS c LEFT JOIN songs AS s ON c.song_id = s.id 
            WHERE s.id = ? AND delete_date IS NULL AND c.song_id IS NOT NULL
            `, [id]
            )
        return res.json(rows)
        }
    } catch (e) {
        console.error(e);
    }
})


app.post('/comment', jwtMiddleware, async(req, res) => {
    const {id, user_id, content, isSong, isAlbum} = req.body;
    try {
        if(isAlbum){
        await pool.query(
        `
        INSERT INTO comment 
        SET content = ?,
        user_id = ?,
        album_id = ?, 
        create_date = NOW()
        `, [content, user_id, id])

        const [rows] = await pool.query(
            `
            SELECT 
            c.id as comment_id, a.id as id, content, (select nickname from users as u where c.user_id = u.id) as nickname, (select id from users as u where c.user_id = u.id) as user_id, DATE_FORMAT(create_date, '%m월 %d일') as create_date
            FROM comment AS c LEFT JOIN album AS a ON c.album_id = a.id 
            WHERE a.id = ? AND delete_date IS NULL AND c.album_id IS NOT NULL
            `, [id]
        )
        return res.json(rows)

        } else if(isSong){
            await pool.query(
                `
                INSERT INTO comment 
                SET content = ?,
                user_id = ?,
                song_id= ?, 
                create_date = NOW()
                `, [content, user_id, id])
            const [rows] = await pool.query(
                    `
                    SELECT 
                    c.id as comment_id, s.id as id, content, (select nickname from users as u where c.user_id = u.id) as nickname, (select id from users as u where c.user_id = u.id) as user_id, DATE_FORMAT(create_date, '%m월 %d일') as create_date
                    FROM comment AS c LEFT JOIN songs AS s ON c.song_id = s.id 
                    WHERE s.id = ? AND delete_date IS NULL AND c.song_id IS NOT NULL
                    `, [id]
                )
            return res.json(rows)
        }
    } catch(e) {
        console.error(e);
    }
})

app.delete('/comment/:id', jwtMiddleware, async(req, res) => {
    const commentId = req.params.id;
    const {id, isSong, isAlbum, isAdmin} = req.body
    const user_id = req.user[0][0].id
    try{
        if(isAdmin){
            await pool.query(
                `
                UPDATE comment
                SET delete_date = NOW()
                WHERE id = ?
                `, [commentId]
            )
        } else {
            const sameAuthor = await pool.query(
                `
                SELECT user_id
                FROM comment
                WHERE id = ?
                `, [commentId]
            )
            if(sameAuthor[0][0].user_id === user_id){
                await pool.query(
                    `
                    UPDATE comment
                    SET delete_date = NOW()
                    WHERE id = ?
                    `, [commentId]
                )
            } else {
                return res.status(400)
            }
        }
        if(isAlbum){
        const [rows] = await pool.query(
            `
            SELECT 
            c.id as comment_id, a.id as id, content, (select nickname from users as u where c.user_id = u.id) as nickname, (select id from users as u where c.user_id = u.id) as user_id, DATE_FORMAT(create_date, '%m월 %d일') as create_date
            FROM comment AS c LEFT JOIN album AS a ON c.album_id = a.id 
            WHERE a.id = ? AND delete_date IS NULL AND c.album_id IS NOT NULL
            `, [id]
        )
        return res.json(rows)
        } else if(isSong){
            const [rows] = await pool.query(
                `
                SELECT 
                c.id as comment_id, s.id as id, content, (select nickname from users as u where c.user_id = u.id) as nickname, (select id from users as u where c.user_id = u.id) as user_id, DATE_FORMAT(create_date, '%m월 %d일') as create_date
                FROM comment AS c LEFT JOIN songs AS s ON c.song_id = s.id 
                WHERE s.id = ? AND delete_date IS NULL AND c.song_id IS NOT NULL
                `, [id]
            )
            return res.json(rows)
        }
    } catch(e) {
        console.error(e);
    }
})

app.put('/comment/:id', jwtMiddleware, async(req, res) => {
    const commentId = req.params.id;
    const {id, content, isSong, isAlbum, isAdmin} = req.body.data
    const user_id = req.user[0][0].id
    try{
        if(isAdmin){
            if(isAlbum){
                await pool.query(
                    `
                    UPDATE comment
                    SET content = ?,
                    modified_date = NOW()
                    WHERE id = ?
                    `, [content, commentId]
                )
                const [rows] = await pool.query(
                    `
                    SELECT 
                    c.id as comment_id, a.id as id, content, (select nickname from users as u where c.user_id = u.id) as nickname, (select id from users as u where c.user_id = u.id) as user_id, DATE_FORMAT(create_date, '%m월 %d일') as create_date
                    FROM comment AS c LEFT JOIN album AS a ON c.album_id = a.id 
                    WHERE a.id = ? AND delete_date IS NULL AND c.album_id IS NOT NULL
                    `, [id]
                )
                res.json(rows)
            } else if(isSong) {
                await pool.query(
                    `
                    UPDATE comment
                    SET content = ?,
                    modified_date = NOW()
                    WHERE id = ?
                    `, [content, commentId]
                )
                const [rows] = await pool.query(
                    `
                    SELECT 
                    c.id as comment_id, s.id as id, content, (select nickname from users as u where c.user_id = u.id) as nickname, (select id from users as u where c.user_id = u.id) as user_id, DATE_FORMAT(create_date, '%m월 %d일') as create_date
                    FROM comment AS c LEFT JOIN songs AS s ON c.song_id = s.id 
                    WHERE s.id = ? AND delete_date IS NULL AND c.song_id IS NOT NULL
                    `, [id]
                )
                return res.json(rows)
            }
        } else {
            const sameAuthor = await pool.query(
                `
                SELECT user_id
                FROM comment
                WHERE id = ?
                `, [commentId]
            )
            if(sameAuthor[0][0].user_id === user_id){
                if(isAlbum){
                    await pool.query(
                        `
                        UPDATE comment
                        SET content = ?,
                        modified_date = NOW()
                        WHERE id = ?
                        `, [content, commentId]
                    )
                    const [rows] = await pool.query(
                        `
                        SELECT 
                        c.id as comment_id, a.id as id, content, (select nickname from users as u where c.user_id = u.id) as nickname, (select id from users as u where c.user_id = u.id) as user_id, DATE_FORMAT(create_date, '%m월 %d일') as create_date
                        FROM comment AS c LEFT JOIN album AS a ON c.album_id = a.id 
                        WHERE a.id = ? AND delete_date IS NULL AND c.album_id IS NOT NULL
                        `, [id]
                    )
                    res.json(rows)
                } else if(isSong) {
                    await pool.query(
                        `
                        UPDATE comment
                        SET content = ?,
                        modified_date = NOW()
                        WHERE id = ?
                        `, [content, commentId]
                    )
                    const [rows] = await pool.query(
                        `
                        SELECT 
                        c.id as comment_id, s.id as id, content, (select nickname from users as u where c.user_id = u.id) as nickname, (select id from users as u where c.user_id = u.id) as user_id, DATE_FORMAT(create_date, '%m월 %d일') as create_date
                        FROM comment AS c LEFT JOIN songs AS s ON c.song_id = s.id 
                        WHERE s.id = ? AND delete_date IS NULL AND c.song_id IS NOT NULL
                        `, [id]
                    )
                    return res.json(rows)
                }
        } else {
            return res.status(400)
        }}
    } catch (e) {
        console.error(e);
    }
})

app.get('/rating', async(req, res) => {
    const {user_id, id, isSong, isAlbum} = req.query;
    try{
        if(isAlbum === "true"){
            const [rows] = await pool.query(
                `
                SELECT rate
                FROM album_rating
                WHERE user_id = ? AND album_id = ?
                `
            , [user_id, id])
            if(rows){
                return res.send(rows);
            }
        } else if(isSong === "true"){
            const [rows] = await pool.query(
                `
                SELECT rate
                FROM songs_rating
                WHERE user_id = ? AND song_id = ?
                `
            , [user_id, id])
            if(rows){
                return res.send(rows);
            }
        }
    } catch (e) {
        console.error(e);
    } 
})

app.post('/rating', async(req, res) => {
    const {rate, user_id, id, isSong, isAlbum} = req.body.data;
    try{
        if(isAlbum){
            const [rows] = await pool.query(
                `
                SELECT rate
                FROM album_rating
                WHERE user_id = ? AND album_id = ?
                `
                , [user_id, id])
                if(rows.length===0){
                    await pool.query(
                        `
                        INSERT INTO album_rating
                        SET rate = ?,
                        user_id = ?,
                        album_id = ?
                        `, [ rate, user_id, id]
                    )
                } else {
                    await pool.query(
                        `
                        UPDATE album_rating 
                        SET rate = ?
                        WHERE user_id = ? AND album_id = ?
                        `, [rate, user_id, id])
                }
            const [response] = await pool.query(
                `
                SELECT 
                rate
                FROM album_rating
                WHERE user_id = ? AND album_id = ?
                `, [user_id, id]
                )
            return res.json(response);

        } else if(isSong){
            const [rows] = await pool.query(
                `
                SELECT rate
                FROM songs_rating
                WHERE user_id = ? AND song_id = ?
                `
                , [user_id, id])
            if(rows.length===0){
                await pool.query(
                    `
                    INSERT INTO songs_rating
                    SET rate = ?,
                    user_id = ?,
                    song_id = ?
                    `, [ rate, user_id, id]
                )} else {
                    await pool.query(
                    `
                    UPDATE songs_rating 
                    SET rate = ?
                    WHERE user_id = ? AND song_id = ?
                    `, [rate, user_id, id])
                }
                const [response] = await pool.query(
                    `
                    SELECT rate
                    FROM songs_rating
                    WHERE user_id = ? AND song_id = ?
                    `, [user_id, id]
                    )
                return res.json(response);
            }
    } catch (e) {
        console.error(e)
    }
})

app.delete('/rating', async(req, res) => {
    const {user_id, id, isAlbum, isSong} = req.body
    try{
        if(isAlbum){
            await pool.query(
                `
                DELETE FROM album_rating
                WHERE user_id = ? AND album_id = ?
                `,[ user_id, id ])
            return res.json(200)
        } else if(isSong){
            await pool.query(
                `
                DELETE FROM songs_rating
                WHERE user_id = ? AND song_id = ?
                `, [user_id, id])
            return res.json(200)
        }
    } catch (e) {
        console.error(e)
    } 
})

// 게시판 
app.get('/board/total', async(req, res) => {
    try{
        const [rows] = await pool.query(
            `
            SELECT bc.name, b.id, b.subject, (select nickname from users as u where b.user_id = u.id) as nickname, date_format(b.created_date, '%m/%d') as created_date, hits
            FROM board as b LEFT JOIN board_category as bc ON b.category = bc.id where bc.id != 5 ORDER BY id DESC
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
            FROM board as b LEFT JOIN board_category as bc ON b.category = bc.id WHERE bc.id = 1 ORDER BY id DESC
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
            FROM board as b LEFT JOIN board_category as bc ON b.category = bc.id WHERE bc.id = 2 ORDER BY id DESC
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
            FROM board as b LEFT JOIN board_category as bc ON b.category = bc.id WHERE bc.id = 3 ORDER BY id DESC
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
            FROM board as b LEFT JOIN board_category as bc ON b.category = bc.id WHERE bc.id = 4 ORDER BY id DESC
            `
        )
        res.json(rows);
    } catch(e) {
        console.error(e)
    }
 })

 app.get('/board/notice', async(req, res) => {
    try{
        const [rows] = await pool.query(
            `
            SELECT bc.name, b.id, b.subject, (select nickname from users as u where b.user_id = u.id) as nickname, date_format(b.created_date, '%m/%d') as created_date, hits
            FROM board as b LEFT JOIN board_category as bc ON b.category = bc.id WHERE bc.id = 5 ORDER BY id DESC
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
            SELECT b.id, b.subject, b.content, b.user_id, 
            (SELECT nickname FROM users AS u WHERE b.user_id = u.id) AS nickname,
            (SELECT id FROM users AS u WHERE bc.user_id = u.id) AS comment_user,
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

 app.post('/board', jwtMiddleware, async(req, res) => {
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

 app.delete('/board/:id', jwtMiddleware, async(req, res)=> {
    const id = req.params.id;
    const {user_id} = req.body;
    try{
        if(user_id === req.user[0][0].id){
            const response = await pool.query(
                `
                DELETE FROM board
                WHERE id = ?
                `, [id]
            )
            res.json(response)
        } else {
            return res.status(400)
        }
    } catch(e) {
        console.error(e)
    }
 })

app.put('/board/:id', jwtMiddleware, async(req, res) => {
    const id = req.params.id;
    const {subject, content, user_id, category, isAdmin} = req.body
    try{
        if(isAdmin){
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
        } else {
            const sameAuthor = await pool.query(
                `
                select user_id from board where id = ?
                `, [id]
            )
            if (sameAuthor[0][0].user_id === user_id) {
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
            } else {
                res.status(400)
            }}
    } catch(e) {
        console.error(e)
    }
 })

app.post('/board/comment/:id', jwtMiddleware, async(req, res) => {
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

app.delete('/board/comment/:id', jwtMiddleware, async(req, res) => {
    const id = req.params.id;
    const { board_id, isAdmin } = req.body
    try {
        if(isAdmin){
            await pool.query(
                `
                DELETE FROM board_comment
                WHERE id = ?
                `, [id]
            )
            const response = await pool.query(
                `
                SELECT bc.content AS comment_content, 
                (SELECT nickname FROM users AS u WHERE bc.user_id = u.id) AS comment_name, (SELECT id FROM users AS u WHERE bc.user_id = u.id) AS comment_user, date_format(bc.created_date, '%m %d') AS c_created_date, bc.id as comment_id
                FROM board_comment AS bc
                WHERE bc.board_id = ?
                `, [board_id]
            )
            res.json(response)
        } else {
        const sameAuthor = await pool.query(
            `
            SELECT user_id 
            FROM board_comment
            WHERE id = ?
            `
        , [id])
        if(sameAuthor[0][0].user_id === req.user[0][0].id){
        await pool.query(
            `
            DELETE FROM board_comment
            WHERE id = ?
            `, [id]
        )
        const response = await pool.query(
            `
            SELECT bc.content AS comment_content, 
            (SELECT nickname FROM users AS u WHERE bc.user_id = u.id) AS comment_name, (SELECT id FROM users AS u WHERE bc.user_id = u.id) AS comment_user, date_format(bc.created_date, '%m %d') AS c_created_date, bc.id as comment_id
            FROM board_comment AS bc
            WHERE bc.board_id = ?
            `, [board_id]
        )
        res.json(response)
        } else {
            res.status(400)
        }
    }} catch(e) {
        console.error(e)
    }
 })

app.put('/board/comment/:id', jwtMiddleware, async(req, res) => {
    const id = req.params.id;
    const { content, user_id, board_id, isAdmin } = req.body
    try{
        if(isAdmin){
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
                (SELECT nickname FROM users AS u WHERE bc.user_id = u.id) AS comment_name, (SELECT id FROM users AS u WHERE bc.user_id = u.id) AS comment_user, date_format(bc.created_date, '%m %d') AS c_created_date, bc.id as comment_id
                FROM board_comment AS bc
                WHERE bc.board_id = ?
                `, [board_id]
            )
            res.json(response)
            console.log(response[0])
        } else {
            const sameAuthor = await pool.query(
                `
                SELECT user_id 
                FROM board_comment
                WHERE id = ?
                `
            , [id])
            if(sameAuthor[0][0].user_id === req.user[0][0].id){
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
                    (SELECT nickname FROM users AS u WHERE bc.user_id = u.id) AS comment_name, (
                    SELECT id FROM users AS u WHERE bc.user_id = u.id) AS comment_user, 
                    date_format(bc.created_date, '%m %d') AS c_created_date, bc.id as comment_id
                    FROM board_comment AS bc
                    WHERE bc.board_id = ?
                    `, [board_id]
                )
                res.json(response)
            } else {
            res.status(400)
            }
        }} catch(e) {
            console.error(e)
        }
 })

 
// Home 관련 함수

app.get('/getnotice', async(req, res) => {
    try {
        const response = await pool.query(
            `
            SELECT id, subject, DATE_FORMAT(created_date, '%Y-%m-%d') AS date 
            FROM board WHERE category = 5 ORDER BY id DESC LIMIT 3
            `
        )
        res.json(response)
    } catch(e) {
        console.error(e)
    }
})

app.get('/gettoprate', async(req, res) => {
    const topAlbum = await pool.query(
        `
        SELECT ac.image_url, (SELECT a.title FROM album AS a WHERE a.id = ar.album_id) AS title, 
        (SELECT a.artist FROM album AS a WHERE a.id = ar.album_id) AS artist, ar.rate AS rate FROM album_rating ar LEFT JOIN album_cover ac ON ar.album_id = ac.album_id ORDER BY rate DESC LIMIT 1
        `
    )
    const topSongs = await pool.query(
        `
        SELECT sc.image_url, (SELECT s.title FROM songs AS s WHERE s.id = sr.song_id) AS title, 
        (SELECT s.artist FROM songs AS s WHERE s.id = sr.song_id) AS artist, sr.rate AS rate FROM songs_rating sr LEFT JOIN songs_cover sc ON sr.song_id = sc.songs_id ORDER BY rate DESC LIMIT 1
        `
    )
    const album = topAlbum[0][0]
    const song = topSongs[0][0]

    const response = {
        albumUrl : album.image_url,
        albumTitle : album.title,
        albumArtist : album.artist,
        albumRate : album.rate,
        songUrl : song.image_url,
        songTitle : song.title,
        songArtist : song.artist,
        songRate : song.rate
    }
    res.json(response)
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

app.get("/getsongs", (req, res) => {
    const getSongs = async () => {
        const response = await axios.get(GET_TOP_TRACKS, {})
        for(let i=0; i<(response.data.tracks.track).length; i++){
            const song_title = response.data.tracks.track[i].name;
            const song_artist = response.data.tracks.track[i].artist.name;
            const song_cover = response.data.tracks.track[i].image[2]['#text']
            await pool.query(
                `
                insert into songs
                set title = ?, artist = ?
                `, [song_title, song_artist]
            )
            await pool.query(
                `
                insert into songs_cover
                set image_url = ?, songs_id = ?
                `, [song_cover, (i+1)]
            )
        }
        
    }
    getSongs()
})

app.listen(port, () => {
  console.log(`서버가 열려있습니다 =>  ${port}`)
})