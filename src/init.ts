import * as Cord from '@cord.network/sdk';
import { UUID, Crypto } from '@cord.network/utils'

import {
  blake2AsU8a,
  keyExtractPath,
  keyFromPath,
  mnemonicGenerate,
  mnemonicToMiniSecret,
  sr25519PairFromSeed,
} from '@polkadot/util-crypto'

import { User } from './entity/User';

const { CORD_WSS_URL, MNEMONIC, ANCHOR_URI } = process.env;

export let authorIdentity: any = undefined;
export let issuerDid: any = undefined;
export let issuerKeys: any = undefined;

function generateKeyAgreement(mnemonic: string) {
  const secretKeyPair = sr25519PairFromSeed(mnemonicToMiniSecret(mnemonic))
  const { path } = keyExtractPath('//did//keyAgreement//0')
  const { secretKey } = keyFromPath(secretKeyPair, path, 'sr25519')
  return Cord.Utils.Crypto.makeEncryptionKeypairFromSeed(blake2AsU8a(secretKey))
}

function generateKeypairs(mnemonic = mnemonicGenerate()) {
    const keyring = new Cord.Utils.Keyring({
	ss58Format: 29,
	type: 'sr25519',
    })

    const account = keyring.addFromMnemonic(mnemonic) as Cord.CordKeyringPair;
    const authentication = {
	...account.derive('//did//0'),
	type: 'sr25519',
    } as Cord.CordKeyringPair
    
    const assertionMethod = {
	...account.derive('//did//assertion//0'),
	type: 'sr25519',
    } as Cord.CordKeyringPair
    
    const capabilityDelegation = {
	...account.derive('//did//delegation//0'),
	type: 'sr25519',
    } as Cord.CordKeyringPair
    
    const keyAgreement = generateKeyAgreement(mnemonic)
    
    return {
	authentication: authentication,
	keyAgreement: keyAgreement,
	assertionMethod: assertionMethod,
	capabilityDelegation: capabilityDelegation,
    }
}

export async function queryFullDid(
  didUri: Cord.DidUri
): Promise<Cord.DidDocument | null> {
  const did = await Cord.Did.resolve(didUri);
  if (did?.metadata?.deactivated) {
    console.log(`DID ${didUri} has been deleted.`)
    return null
  } else if (did?.document === undefined) {
    console.log(`DID ${didUri} does not exist.`)
    return null
  } else {
    return did?.document
  }
}

export async function createDid(mnemonic: string | undefined) {
    try  {
    const api = Cord.ConfigService.get('api')
    if (!mnemonic) {
	mnemonic = mnemonicGenerate(24)	
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
	)

	await Cord.Chain.signAndSubmitTx(didCreationTx, authorIdentity)

	const encodedDid = await api.call.did.query(Cord.Did.toChain(didUri))
	const { document } = Cord.Did.linkedInfoFromChain(encodedDid)
	if (!document) {
	    throw new Error('DID was not successfully created.')
	}
	return { mnemonic, identity, document }
    } else {
	return { mnemonic, identity, document: check };
    }

    } catch (err) {
	return { mnemonic: '', identity: {}, document: { uri: ''}}
    }
}

export async function setupDidAndIdentities() {
    Cord.ConfigService.set({ submitTxResolveOn: Cord.Chain.IS_IN_BLOCK })
    await Cord.connect(CORD_WSS_URL ?? 'ws://localhost:9944')

    authorIdentity = await Crypto.makeKeypairFromUri(ANCHOR_URI ?? '//Alice', 'sr25519')

    const { document: did, identity: keys } = await createDid(MNEMONIC);
    issuerDid = did;
    issuerKeys = keys;
}



