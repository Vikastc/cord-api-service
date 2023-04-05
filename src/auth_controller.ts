/* eslint-disable @typescript-eslint/no-non-null-assertion */
import express from 'express';
import { getConnection } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as Cord from '@cord.network/sdk';

import { io } from './server';
import { User } from './entity/User';
import { Session } from './entity/Session';
import { sessionStore } from './server';

const { AGENT_URL } = process.env;

export async function isLoggedIn(req: express.Request) {
    if (req.session && req.session.did) {
       	return { login: true, session: req.session }	
    }
    return { login: false, message: 'Scan the QR from your dhi-wallet'};
}

export async function authLogout(req: express.Request, res: express.Response) {
    res.json({ error: 'function not implemented'});
}

export async function authLoginCheck(
    req: express.Request,
    res: express.Response
) {
    const response = await isLoggedIn(req);

    return res.json(response);
}


export async function authSignup(
    req: express.Request,
    res: express.Response
) {
    const response = await isLoggedIn(req);
    if (response.login) {
       return res.json({error: "User already logged in"});
    }
    const details = {
        endpoint: `${AGENT_URL}/api/v1/auth/submit`,
        challenge: req.sessionID,
	fields: ["name", "email"]
    }
    const qrStr = JSON.stringify(details);

    res.json({
        login: details,
	qrStr,
        qr: `https://hashcodedemo.dhiway.com/?text=cord://${qrStr}`
    });

    return true;
}


async function verifyCall(presentation: any, challenge: string) {
    try {
        // Verify the presentation with the provided challenge.
        await Cord.Document.verifyPresentation(presentation, { challenge })

        // Verify the credential by checking the stream on the blockchain.
        const api = Cord.ConfigService.get('api')
        const chainIdentifier = Cord.Stream.idToChain(presentation.identifier)
        const streamOnChain = await api.query.stream.streams(chainIdentifier)
        const stream = Cord.Stream.fromChain(streamOnChain, chainIdentifier)
        if (stream.revoked) {
	    console.log("Revoked");
            return null
        }
	console.log("Stream: ", stream);
        return stream;
    } catch (err: any) {
        console.log("Error: ", err);
        return null;
    }
}
    
export async function authSubmit(
    req: express.Request,
    res: express.Response
) {
    const data = req.body;

    const presentation = data.presentation;
    const challenge = data.challenge;
    if (!presentation || !challenge) {
       console.log("no presentation or challenge");
	return res.status(400).json({error: 'send presentation and challenge'})
    }
    const result = await verifyCall(presentation, challenge);
    console.log("verification: ", result);
    if (result) {
        try {
            sessionStore.get(challenge, (err: any, session: any) => {
                if (!session) {
                    res.status(500).json({ error: 'Invalid Request' });
                    return;
                }
                if (err) {
                    res.status(500).json({ error: err });
                    return;
                }
		if (session.did) {
		    res.status(400).json({ error: 'already logged in' });
		    return;
		}
                session.did = result.issuer ?? 'did:cord:<undefined>';
		session.email = presentation?.content?.contents?.email ?? 'something@wrong.com';
		session.name = presentation?.content?.contents?.name ?? 'Anonymous / Guest';
                sessionStore.set(challenge, session, (err: any) => {
                    if (err) {
                        res.status(500).json({ error: err });
                        return;
                    }
                });
		io.in(challenge).emit('login', session);
            });
        } catch (err) {
            return res.status(500).json({ error: err });
        }
    }
    return true;
}
