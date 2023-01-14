import express from 'express';

export const ratingRouter = express.Router();

ratingRouter.get('/rating', async(req, res) => {
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

ratingRouter.post('/rating', async(req, res) => {
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

ratingRouter.delete('/rating', async(req, res) => {
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
