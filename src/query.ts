import express from 'express';
import * as Cord from '@cord.network/sdk';

import { linkedInfoFromChain, toChain } from './init';
import { fromChain } from './helper';

export async function queryDidEncoded(res: express.Response, identifier: any) {
    const api = Cord.ConfigService.get('api');

    try {
        const didUri = identifier as Cord.DidUri;

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
        return res.json({ error: error });
    }
}

export async function queryStream(res: express.Response, identifier: any) {
    const api = Cord.ConfigService.get('api');

    try {
        const chainIdentifier = identifier;

        const streamOnChain = await api.query.stream.streams(chainIdentifier);

        const stream = fromChain(streamOnChain, chainIdentifier);

        return res.json(stream);
    } catch (error) {
        console.log('err: ', error);
        return res.json({ error: error });
    }
}

export async function queryDid(res: express.Response, identifier: any) {
    const api = Cord.ConfigService.get('api');

    try {
        const did = identifier as Cord.DidUri;

        const queried = await api.query.did.did(toChain(did));

        return res.json(queried);
    } catch (error) {
        console.log('err: ', error);
        return res.json({ error: error });
    }
}

export async function queryBlacklist(res: express.Response, identifier: any) {
    const api = Cord.ConfigService.get('api');

    try {
        const did = identifier as Cord.DidUri;

        const isdidDeleted = await api.query.did.didBlacklist(toChain(did));

        return res.json(isdidDeleted);
    } catch (error) {
        console.log('err: ', error);
        return res.json({ error: error });
    }
}

export async function querySystem(res: express.Response, identifier: any) {
    const api = Cord.ConfigService.get('api');

    if (identifier === 'number') {
        try {
            const number = await api.query.system.number();

            return res.json(number);
        } catch (error) {
            console.log('err: ', error);
            return res.json({ error: error });
        }
    }
}

export async function queryRegistry(res: express.Response, identifier: any) {
    try {
        const api = Cord.ConfigService.get('api');

        const encoded = await api.query.registry.registries(identifier);

        return res.json(encoded);
    } catch (error) {
        console.log('err: ', error);
        return res.json({ error: error });
    }
}
