import express from 'express';
import * as Cord from '@cord.network/sdk';

import { linkedInfoFromChain, toChain } from './init';
import { fromChain } from './helper';

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

export async function queryDid(
    res: express.Response,
    identifier: any,
    section: string
) {
    const api = Cord.ConfigService.get('api');

    try {
        const did = identifier as Cord.DidUri;

        if (section === 'query') {
            const encodedDid = await api.call.did.query(toChain(did));

            const { document } = linkedInfoFromChain(encodedDid);

            if (!document) {
                throw new Error('DID was not successfully created.');
            }
            return res.json(document);
        }

        if (section === 'did') {
            const queried = await api.query.did.did(toChain(did));
            return res.json(queried);
        }

        if (section === 'didBlacklist') {
            const isdidDeleted = await api.query.did.didBlacklist(toChain(did));
            return res.json(isdidDeleted);
        }
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

export async function queryRegistry(
    res: express.Response,
    identifier: any,
    section: string
) {
    const api = Cord.ConfigService.get('api');

    try {
        if (section === 'registries') {
            const encoded = await api.query.registry.registries(identifier);
            return res.json(encoded);
        }
        if (section === 'authorizations') {
            const encoded = await api.query.registry.authorizations(identifier);
            return res.json(encoded);
        }
        if (section === 'fetchAuthorizations') {
            const authorizationId = identifier;
            const registryAuthoriation =
                await api.query.registry.authorizations(authorizationId);

            return res.json(registryAuthoriation);
        }
    } catch (error) {
        console.log('err: ', error);
        return res.json({ error: error });
    }
}
