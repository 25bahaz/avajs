***MY NETWORK MANAGER FUNCTIONAL REQUIREMENTS***

**validator manager service**
- add validator
- remove validator
- disable validator
- update weight validator
- search/filter validators
- list validator status

**allowlist manager service**
- change blockchain owner address
- add address to transaction allowlist
- add address to contract deployer allowlist
- remove address from transaction allowlist
- remove address from contract deployer allowlist

**fee config manager service**
- change fee config

**native token mint service**
- mint native token
- burn native token

**utils**
- unit converter
- encode/decode (base58, cb58, hex etc.)
- text compare (araxis merge)

---------- phase 2 ----------

**block explorer service(readonly)**
- list recent blocks
- search block by blockNumber

**address explorer(readonly)**
- ????

**event indexer service(readonly)**
- list recent events
- search/filter events by name 
- search/filter events by txHash
- search/filter events by blockHash
- search/filter events by blockNumber
- filter transactions by time

**tx explorer service(readonly)**
- list recent transactions 
- search transaction by hash
- search transaction by blockHash
- search transaction by blockNumber
- search/filter transaction by status
- filter transactions by time
- filter transaction by from address
- filter transaction by to address

**rpc call service**
- available rpc calls

