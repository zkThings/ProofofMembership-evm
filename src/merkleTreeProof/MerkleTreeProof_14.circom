pragma circom 2.0.0;

include "mimcsponge.circom";

template HashLeftRight() {
    signal input left;
    signal input right;
    signal output hash;

    component hasher = MiMCSponge(2, 220, 1);
    hasher.ins[0] <== left;
    hasher.ins[1] <== right;
    hasher.k <== 0;
    hash <== hasher.outs[0];
}

template MerkleProof(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal input root;

    component hashers[levels];
    signal hashes[levels + 1];
    hashes[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        hashers[i] = HashLeftRight();
        hashers[i].left <== pathIndices[i] * (pathElements[i] - hashes[i]) + hashes[i];
        hashers[i].right <== (1 - pathIndices[i]) * (pathElements[i] - hashes[i]) + hashes[i];
        hashes[i + 1] <== hashers[i].hash;
    }

    root === hashes[levels];
}

// Replace 14 with the desired depth during code generation
component main {public [leaf, root]} = MerkleProof(14);
