/* eslint-disable @typescript-eslint/no-non-null-assertion */
import express from 'express';
import { getConnection } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as Cord from '@cord.network/sdk';

import { io } from './server';
import { User } from './entity/User';
import { Session } from './entity/Session';
import { sessionStore } from './server';

import { authorIdentity, setupDidAndIdentities } from './init';

export async function postExtrinsic(req: express.Request, res: express.Response) {
    if (!authorIdentity) {
	await setupDidAndIdentities();
    }
    const api = Cord.ConfigService.get('api');

    /* TODO: authentication check */
    
    const data = req.body;
    //const extrinsic = Buffer.from(data.message, 'base64');
    const extrinsic = api.tx(data.extrinsic);
    const response = await Cord.Chain.signAndSubmitTx(extrinsic, authorIdentity);
    
    return res.json({ response });
}

async function getDID(uri: string) {
    const did = await Cord.Did.resolve(uri as Cord.DidUri);
    if (did?.metadata?.deactivated) {
        console.log(`DID ${uri} has been deleted.`);
        return null;
    } else if (did?.document === undefined) {
        console.log(`DID ${uri} does not exist.`);
        return null;
    }
    return did?.document;
}

export async function queryIdentifiers(
    req: express.Request,
    res: express.Response
) {

    /* Depending on the type of identifier, query corresponding pallets */
    if (req.query.did) {
	return res.json({ did: await getDID(req.params.identifier)});
    }

    res.json({msg: "enosys"})
}
