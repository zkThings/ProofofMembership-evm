const buildMimcSponge = require("./mimcSponge.js"); // Custom MiMC Sponge function
const ethers = require("ethers");
const fs = require('fs');

// Helper function to convert comma-separated bytes into a continuous hex string
function cleanHexString(hexString) {
    return hexString.replace(/,/g, '').replace(/\s+/g, ''); // Remove commas and spaces
}

// Function to perform MiMC Sponge hashing on two inputs
async function mimcHash(left, right) {
    const mimcSponge = await buildMimcSponge();

    // Convert the inputs to BigInt from properly formatted hex strings
    const leftBigInt = BigInt(`0x${cleanHexString(left)}`);
    const rightBigInt = BigInt(`0x${cleanHexString(right)}`);

    const mimcResult = await mimcSponge.multiHash([leftBigInt, rightBigInt], 0);
    return mimcResult.toString(16);  // Return as a hex string without '0x'
}

// Convert each value in the object to a hash using Keccak256 and format as hex string without '0x'
async function generateLeaves(dataObject) {
    const leaves = [];
    for (let key in dataObject) {
        const hash = ethers.keccak256(ethers.toUtf8Bytes(dataObject[key]));
        leaves.push(hash.slice(2));  // Store the hash as a continuous hex string
    }
    console.log("Generated Leaves:", leaves);  // Debugging log
    return leaves;
}

// Function to build the Merkle tree and generate the root
async function buildMerkleTree(leaves) {
    let level = leaves;
    while (level.length > 1) {
        const nextLevel = [];
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i];
            const right = i + 1 < level.length ? level[i + 1] : left;
            const hash = await mimcHash(left, right);
            nextLevel.push(hash);  // Push the result to the next level
        }
        level = nextLevel;
    }
    console.log("Final Root Level:", level);  // Debugging log
    return level[0];  // The root of the tree
}

// Main function to generate the Merkle tree and proof for Circom circuit
async function prepareMerkleTreeInputs(dataObject) {
    // Step 1: Generate leaves
    const leaves = await generateLeaves(dataObject);
    console.log("Leaves:", leaves);

    // Step 2: Build the Merkle tree and get the root
    const merkleRoot = await buildMerkleTree(leaves);
    console.log("Merkle Root:", merkleRoot);

    // Step 3: Create Input JSON for Circom Circuit
    const input = {
        leaf: leaves[0],  // Example: checking the first leaf
        root: merkleRoot,
        leaves: leaves
    };

    fs.writeFileSync('input.json', JSON.stringify(input, null, 2));
    console.log("Input JSON generated for Circom circuit:", input);
}

// Example usage:
const dataObject = {
    name: "Alice",
    age: "30",
    id: "12345"
};

prepareMerkleTreeInputs(dataObject);
