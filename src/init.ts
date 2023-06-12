import * as Cord from '@cord.network/sdk';
import { Crypto } from '@cord.network/utils';

import { ConfigService } from '@cord.network/config';
import type { AccountId32, Hash } from '@polkadot/types/interfaces';
import type { Option } from '@polkadot/types';
import { BN, u8aToString } from '@polkadot/util';
import type {
    RawDidLinkedInfo,
    PalletDidDidDetails,
    PalletDidDidDetailsDidPublicKeyDetails,
    PalletDidServiceEndpointsDidEndpoint,
} from '@cord.network/augment-api';
import {
    blake2AsU8a,
    keyExtractPath,
    keyFromPath,
    mnemonicGenerate,
    mnemonicToMiniSecret,
    sr25519PairFromSeed,
} from '@polkadot/util-crypto';

import { SDKErrors, DataUtils, ss58Format } from '@cord.network/utils';
import { SubmittableResult } from '@polkadot/api';

import { ErrorHandler } from './chain/errorhandling';

import type {
    ISubmittableResult,
    SubmittableExtrinsic,
    SubscriptionPromise,
    DidUri,
    CordAddress,
    DidDocument,
    DidKey,
    DidVerificationKey,
    DidEncryptionKey,
    DidServiceEndpoint,
} from '@cord.network/types';

import { DidResourceUri, UriFragment } from '@cord.network/types';

import { makeSubscriptionPromise } from './chain/SubscriptionPromise';

export type DidName = string;

const { CORD_WSS_URL, MNEMONIC, ANCHOR_URI } = process.env;

const CORD_DID_REGEX =
    /^did:cord:(?<address>3[1-9a-km-zA-HJ-NP-Z]{47})(?<fragment>#[^#\n]+)?$/;

type IDidParsingResult = {
    did: DidUri;
    version: number;
    type: 'full';
    address: CordAddress;
    fragment?: UriFragment;
    authKeyTypeEncoding?: string;
    encodedDetails?: string;
};

type RpcDocument = Pick<
    DidDocument,
    | 'authentication'
    | 'assertionMethod'
    | 'capabilityDelegation'
    | 'keyAgreement'
> & {
    lastTxCounter: BN;
};

export interface DidInfo {
    document: DidDocument;
    didName?: DidName;
}

const DID_LATEST_VERSION = 1;

const log = ConfigService.LoggingFactory.getLogger('Chain');

export let authorIdentity: any = undefined;
export let issuerDid: any = undefined;
export let issuerKeys: any = undefined;

function generateKeyAgreement(mnemonic: string) {
    const secretKeyPair = sr25519PairFromSeed(mnemonicToMiniSecret(mnemonic));
    const { path } = keyExtractPath('//did//keyAgreement//0');
    const { secretKey } = keyFromPath(secretKeyPair, path, 'sr25519');
    return Cord.Utils.Crypto.makeEncryptionKeypairFromSeed(
        blake2AsU8a(secretKey)
    );
}

function generateKeypairs(mnemonic = mnemonicGenerate()) {
    const keyring = new Cord.Utils.Keyring({
        ss58Format: 29,
        type: 'sr25519',
    });

    const account = keyring.addFromMnemonic(mnemonic) as Cord.CordKeyringPair;
    const authentication = {
        ...account.derive('//did//0'),
        type: 'sr25519',
    } as Cord.CordKeyringPair;

    const assertionMethod = {
        ...account.derive('//did//assertion//0'),
        type: 'sr25519',
    } as Cord.CordKeyringPair;

    const capabilityDelegation = {
        ...account.derive('//did//delegation//0'),
        type: 'sr25519',
    } as Cord.CordKeyringPair;

    const keyAgreement = generateKeyAgreement(mnemonic);

    return {
        authentication: authentication,
        keyAgreement: keyAgreement,
        assertionMethod: assertionMethod,
        capabilityDelegation: capabilityDelegation,
    };
}

export async function queryFullDid(
    didUri: Cord.DidUri
): Promise<Cord.DidDocument | null> {
    const did = await Cord.Did.resolve(didUri);
    if (did?.metadata?.deactivated) {
        console.log(`DID ${didUri} has been deleted.`);
        return null;
    } else if (did?.document === undefined) {
        console.log(`DID ${didUri} does not exist.`);
        return null;
    } else {
        return did?.document;
    }
}

export async function createDid(mnemonic: string | undefined) {
    try {
        const api = Cord.ConfigService.get('api');
        if (!mnemonic) {
            mnemonic = mnemonicGenerate(24);
        }
        const identity = generateKeypairs(mnemonic);
        const {
            authentication,
            keyAgreement,
            assertionMethod,
            capabilityDelegation,
        } = identity;
        // Get tx that will create the DID on chain and DID-URI that can be used to resolve the DID Document.
        const didUri = Cord.Did.getDidUriFromKey(authentication);
        const check = await queryFullDid(didUri);
        if (!check) {
            const didCreationTx = await Cord.Did.getStoreTx(
                {
                    authentication: [authentication],
                    keyAgreement: [keyAgreement],
                    assertionMethod: [assertionMethod],
                    capabilityDelegation: [capabilityDelegation],
                    // Example service.
                    service: [
                        {
                            id: '#my-service',
                            type: ['service-type'],
                            serviceEndpoint: ['https://www.example.com'],
                        },
                    ],
                },
                async ({ data }) => ({
                    signature: authentication.sign(data),
                    keyType: authentication.type,
                })
            );

            await Cord.Chain.signAndSubmitTx(didCreationTx, authorIdentity);

            const encodedDid = await api.call.did.query(
                Cord.Did.toChain(didUri)
            );
            const { document } = Cord.Did.linkedInfoFromChain(encodedDid);
            if (!document) {
                throw new Error('DID was not successfully created.');
            }
            return { mnemonic, identity, document };
        } else {
            return { mnemonic, identity, document: check };
        }
    } catch (err) {
        return { mnemonic: '', identity: {}, document: { uri: '' } };
    }
}

export async function setupDidAndIdentities() {
    Cord.ConfigService.set({ submitTxResolveOn: Cord.Chain.IS_IN_BLOCK });
    await Cord.connect(CORD_WSS_URL ?? 'ws://localhost:9944');

    authorIdentity = await Crypto.makeKeypairFromUri(
        ANCHOR_URI ?? '//Alice',
        'sr25519'
    );

    const { document: did, identity: keys } = await createDid(MNEMONIC);
    issuerDid = did;
    issuerKeys = keys;
}

export function IS_FINALIZED(result: ISubmittableResult): boolean {
    return result.isFinalized;
}

function defaultResolveOn(): SubscriptionPromise.ResultEvaluator {
    return ConfigService.isSet('submitTxResolveOn')
        ? ConfigService.get('submitTxResolveOn')
        : IS_FINALIZED;
}

export function EXTRINSIC_FAILED(result: ISubmittableResult): boolean {
    return ErrorHandler.extrinsicFailed(result);
}

export function IS_ERROR(
    result: ISubmittableResult
): boolean | Error | undefined {
    return result.isError || result.internalError;
}

export async function submitSignedTx(
    tx: SubmittableExtrinsic,
    opts: Partial<SubscriptionPromise.Options> = {}
): Promise<ISubmittableResult> {
    const {
        resolveOn = defaultResolveOn(),
        rejectOn = (result: ISubmittableResult) =>
            EXTRINSIC_FAILED(result) || IS_ERROR(result),
    } = opts;

    const api = ConfigService.get('api');
    if (!api.hasSubscriptions) {
        throw new SDKErrors.SubscriptionsNotSupportedError();
    }

    log.info(`Submitting ${tx.method}`);
    const { promise, subscription } = makeSubscriptionPromise({
        ...opts,
        resolveOn,
        rejectOn,
    });

    let latestResult: SubmittableResult | undefined;
    const unsubscribe = await tx.send((result) => {
        latestResult = result;
        subscription(result);
    });

    function handleDisconnect(): void {
        const result = new SubmittableResult({
            events: latestResult?.events || [],
            internalError: new Error('connection error'),
            status:
                latestResult?.status ||
                api.registry.createType('ExtrinsicStatus', 'future'),
            txHash: api.registry.createType('Hash'),
        });
        subscription(result);
    }

    api.once('disconnected', handleDisconnect);

    try {
        return await promise;
    } catch (e) {
        throw ErrorHandler.getExtrinsicError(e as ISubmittableResult) || e;
    } finally {
        unsubscribe();
        api.off('disconnected', handleDisconnect);
    }
}

export function parse(didUri: DidUri | DidResourceUri): IDidParsingResult {
    const matches = CORD_DID_REGEX.exec(didUri)?.groups;

    if (matches) {
        const { version: versionString, fragment } = matches;
        const address = matches.address as CordAddress;
        const version = versionString
            ? parseInt(versionString, 10)
            : DID_LATEST_VERSION;
        return {
            did: didUri.replace(fragment || '', '') as DidUri,
            version,
            type: 'full',
            address,
            fragment: fragment === '#' ? undefined : (fragment as UriFragment),
        };
    }

    throw new SDKErrors.InvalidDidFormatError(didUri);
}

export function toChain(did: DidUri): CordAddress {
    return parse(did).address;
}

function didPublicKeyDetailsFromChain(
    keyId: Hash,
    keyDetails: PalletDidDidDetailsDidPublicKeyDetails
): DidKey {
    const key = keyDetails.key.isPublicEncryptionKey
        ? keyDetails.key.asPublicEncryptionKey
        : keyDetails.key.asPublicVerificationKey;
    return {
        id: `#${keyId.toHex()}`,
        type: key.type.toLowerCase() as DidKey['type'],
        publicKey: key.value.toU8a(),
    };
}

function resourceIdToChain(id: UriFragment): string {
    return id.replace(/^#/, '');
}

function documentFromChain(encoded: PalletDidDidDetails): RpcDocument {
    const {
        publicKeys,
        authenticationKey,
        assertionKey,
        delegationKey,
        keyAgreementKeys,
        lastTxCounter,
    } = encoded;

    const keys: Record<string, DidKey> = [...publicKeys.entries()]
        .map(([keyId, keyDetails]) =>
            didPublicKeyDetailsFromChain(keyId, keyDetails)
        )
        .reduce((res: Record<string, DidKey>, key) => {
            res[resourceIdToChain(key.id)] = key;
            return res;
        }, {});

    const authentication = keys[
        authenticationKey.toHex()
    ] as DidVerificationKey;

    const didRecord: RpcDocument = {
        authentication: [authentication],
        lastTxCounter: lastTxCounter.toBn(),
    };

    if (assertionKey.isSome) {
        const key = keys[assertionKey.unwrap().toHex()] as DidVerificationKey;
        didRecord.assertionMethod = [key];
    }
    if (delegationKey.isSome) {
        const key = keys[delegationKey.unwrap().toHex()] as DidVerificationKey;
        didRecord.capabilityDelegation = [key];
    }

    const keyAgreementKeyIds = [...keyAgreementKeys.values()].map((keyId) =>
        keyId.toHex()
    );
    if (keyAgreementKeyIds.length > 0) {
        didRecord.keyAgreement = keyAgreementKeyIds.map(
            (id) => keys[id] as DidEncryptionKey
        );
    }

    return didRecord;
}

export function getDidUri(didOrAddress: DidUri | CordAddress): DidUri {
    const address = DataUtils.isCordAddress(didOrAddress)
        ? didOrAddress
        : parse(didOrAddress as DidUri).address;
    return `did:cord:${address}` as DidUri;
}

function fromChain(encoded: AccountId32): DidUri {
    return getDidUri(Crypto.encodeAddress(encoded, ss58Format));
}

function serviceFromChain(
    encoded: PalletDidServiceEndpointsDidEndpoint
): DidServiceEndpoint {
    const { id, serviceTypes, urls } = encoded;
    return {
        id: `#${u8aToString(id)}`,
        type: serviceTypes.map(u8aToString),
        serviceEndpoint: urls.map(u8aToString),
    };
}

function servicesFromChain(
    encoded: PalletDidServiceEndpointsDidEndpoint[]
): DidServiceEndpoint[] {
    return encoded.map((encodedValue) => serviceFromChain(encodedValue));
}

export function linkedInfoFromChain(
    encoded: Option<RawDidLinkedInfo>
): DidInfo {
    const { identifier, name, serviceEndpoints, details } = encoded.unwrap();
    const didRec = documentFromChain(details);
    const did: DidDocument = {
        uri: fromChain(identifier),
        authentication: didRec.authentication,
        assertionMethod: didRec.assertionMethod,
        capabilityDelegation: didRec.capabilityDelegation,
        keyAgreement: didRec.keyAgreement,
    };

    const service = servicesFromChain(serviceEndpoints);
    if (service.length > 0) {
        did.service = service;
    }

    const didName = name.isNone ? undefined : name.unwrap().toHuman();

    return {
        document: did,
        didName,
    };
}
