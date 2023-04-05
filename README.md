# API service

This is the project which provides options to query chain and anchor extrinsic to chain

## APIs

### Submit

POST: /api/v1/extrinsics

Notice that client should build extrinsic and submit data in `{ "extrinsic": await tx.signAsync(authorization) }` format to get it anchored on the chain.

### query

GET : /api/v1/query/:identifiers?params

params:

* rating
* stream
* schema
* registry
* did


## TODO:

### User :-
  - [ ] - Registration based on the email 
  - [ ] - Upon successful verification (go with magic link for now, can be email OTP in future) user marked as valid user
  - [ ] - Registration would give the device a token, can use token in all APIs with cloud wallet

  - [ ] - Provide a mechanism to resolve DID (based on `did:web:`)
  
### Token :-
  - [ ] - Build a basic token management
  - [ ] - Expect token in all APIs (no session based login) - Rethink later
  - [ ] - Token cleanup / Logout feature
