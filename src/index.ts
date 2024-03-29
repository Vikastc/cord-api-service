import fs from 'fs';
import express from 'express';
import { createConnection } from 'typeorm';
import multer from 'multer';
import HandleBars from 'handlebars';
import { v4 as uuidv4 } from 'uuid';

import { setupDidAndIdentities } from './init';
import { app, server } from './server';
import { authSignup, authSubmit, authLoginCheck } from './auth_controller';
import { postExtrinsic, queryIdentifiers } from './cord';

import { dbConfig } from './dbconfig';
const {
    PORT,
    MNEMONIC,
    ANCHOR_URI,
} = process.env;

const authRouter = express.Router({ mergeParams: true });

authRouter.get('/signup', async (req, res) => {
    return await authSignup(req, res);
});

authRouter.post('/submit', async (req, res) => {
    return await authSubmit(req, res);
});

authRouter.get('/check', async (req, res) => {
    return await authLoginCheck(req, res);
});

app.use('/api/v1/auth', authRouter);

app.post('/api/v1/extrinsic', async (req, res) => {
    /* TODO: authentication check */
    /* TODO: add metering */
    return await postExtrinsic(req, res);
});

app.get('/api/v1/query/:identifier', async (req, res) => {
    /* TODO: authentication check */
    /* TODO: add metering */
    return await queryIdentifiers(req, res);
});


// All other routes to React App
app.get('/*', async (req, res) => {
    return res.json({
        message: 'check https://docs.dhiway.com/api for details of the APIs',
    });
});

async function main() {
    if (!PORT) {
        console.log(
            'Environment variable PORT is not set. ' + 'Example PORT=4000'
        );
        return;
    }
    createConnection(dbConfig);

    server.listen(parseInt(PORT, 10), () => {
        console.log(`Dhiway gateway is running at http://localhost:${PORT}`);
    });

    await setupDidAndIdentities();
}

main().catch((e) => console.log(e));
