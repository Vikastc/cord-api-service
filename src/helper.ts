import { ConfigService } from '@cord.network/config';
import type { Option } from '@polkadot/types';
import type {
    IStream,
    IDocument,
    IStreamChain,
    StreamId,
} from '@cord.network/types';
import * as Did from '@cord.network/did';
import type { PalletStreamStreamEntry } from '@cord.network/augment-api';
import { DecoderUtils, Identifier } from '@cord.network/utils';

const log = ConfigService.LoggingFactory.getLogger('Stream');

export function toChain(content: IStream): IStreamChain {
    const chainStream = {
        streamHash: content.streamHash,
        schema: Identifier.uriToIdentifier(content.schema),
    };
    return chainStream;
}

export function idToChain(streamId: IStream['identifier']): StreamId {
    return Identifier.uriToIdentifier(streamId);
}

export function fromChain(
    encoded: Option<PalletStreamStreamEntry>,
    identifier: IDocument['identifier']
): IStream {
    const chainStream = encoded.unwrap();
    const stream: IStream = {
        identifier,
        streamHash: chainStream.digest.toHex(),
        issuer: Did.fromChain(chainStream.creator),
        schema: DecoderUtils.hexToString(chainStream.schema.toString()),
        registry:
            DecoderUtils.hexToString(chainStream.registry.toString()) || null,
        revoked: chainStream.revoked.valueOf(),
    };
    log.info(`Decoded stream: ${JSON.stringify(stream)}`);
    return stream;
}
