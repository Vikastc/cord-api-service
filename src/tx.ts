import express from 'express';
import * as Cord from '@cord.network/sdk';

import { authorIdentity, setupDidAndIdentities, submitSignedTx } from './init';

export async function txSignAndSubmit(
    req: express.Request,
    res: express.Response
) {
    try {
        if (!authorIdentity) {
            await setupDidAndIdentities();
        }

        const api = Cord.ConfigService.get('api');
        const data = req.body;

        const extrinsic = api.tx(data.extrinsic);
        // Signing the tx
        const signedTx = await extrinsic.signAsync(authorIdentity, {
            nonce: -1,
        });
        // Submitting the tx
        const response = await submitSignedTx(signedTx);

        return res.json({ response });
    } catch (error) {
        console.log('error: ', error);
        return res.json({ err: error });
    }
}

export async function txStreamBench(
    req: express.Request,
    res: express.Response
) {
    try {
        if (!authorIdentity) {
            await setupDidAndIdentities();
        }

        const api = Cord.ConfigService.get('api');
        const data = req.body;

        const extrinsic = api.tx(data.extrinsic);
        const signedAndSubmited = extrinsic.signAndSend(authorIdentity);

        return res.json({ signedAndSubmited });
    } catch (error) {
        console.log('error: ', error);
        return res.json({ err: error });
    }
}
