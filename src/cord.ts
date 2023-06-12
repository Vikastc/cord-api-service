/* eslint-disable @typescript-eslint/no-non-null-assertion */
import express from 'express';
import * as Cord from '@cord.network/sdk';

import {
    authorIdentity,
    linkedInfoFromChain,
    setupDidAndIdentities,
    submitSignedTx,
    toChain,
} from './init';

export async function postExtrinsic(
    req: express.Request,
    res: express.Response
) {
    try {
        if (!authorIdentity) {
            await setupDidAndIdentities();
        }

        const api = Cord.ConfigService.get('api');

        /* TODO: authentication check */

        const data = req.body;
        //const extrinsic = Buffer.from(data.message, 'base64');

        // const response = await Cord.Chain.signAndSubmitTx(
        //     extrinsic,
        //     authorIdentity
        // );

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
        return res.json({ did: await getDID(req.params.identifier) });
    }

    res.json({ msg: 'enosys' });
}

export async function queryDid(req: express.Request, res: express.Response) {
    const data = req.body;

    const api = Cord.ConfigService.get('api');
    const didUri = data.did;

    try {
        if (didUri) {
            const encodedDid = await api.call.did.query(toChain(didUri));

            const { document } = linkedInfoFromChain(encodedDid);

            if (!document) {
                throw new Error('DID was not successfully created.');
            }
            return res.json(document);
        }
    } catch (error) {
        console.log('err: ', error);
        return res.json({ err: error });
    }
}
