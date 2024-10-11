import OpenAI from "openai";

// Add a file to an existing vector store in OpenAI by its ID
export interface AddFileToVectorStoreParams {
  vectorStoreId: string;
  fileId: string;
  openai: OpenAI;
}
export async function addFileToVectorStore({
  vectorStoreId,
  fileId,
  openai,
}: AddFileToVectorStoreParams) {
  const vectorStoreFile = await openai.beta.vectorStores.files.create(
    vectorStoreId,
    {
      file_id: fileId,
    }
  );
  return vectorStoreFile.id;
}

// Remove a file from a vector store by file ID
export interface DeleteVectorStoreFileParams {
  vectorStoreId: string;
  fileId: string;
  openai: OpenAI;
}
export async function deleteVectorStoreFile({
  vectorStoreId,
  fileId,
  openai,
}: DeleteVectorStoreFileParams) {
  return await openai.beta.vectorStores.files.del(vectorStoreId, fileId);
}

// List all files stored in a specified vector store
export interface ListVectorStoreFilesParams {
  vectorStoreId: string;
  openai: OpenAI;
}
export async function listVectorStoreFiles({
  vectorStoreId,
  openai,
}: ListVectorStoreFilesParams) {
  return await openai.beta.vectorStores.files.list(vectorStoreId);
}

// Locate or create a new vector store in OpenAI
export interface FindOrCreateVectorStoreParams {
  vectorStoreName: string;
  openai: OpenAI;
}
export async function findOrCreateVectorStore({
  vectorStoreName,
  openai,
}: FindOrCreateVectorStoreParams) {
  try {
    // Check if the vector store already exists by name
    const existingVectorStores = await openai.beta.vectorStores.list();
    const matchedVectorStore = existingVectorStores.data.find(
      ({ name }) => name === vectorStoreName
    );

    // If found, retrieve and return the vector store
    if (matchedVectorStore) {
      return await openai.beta.vectorStores.retrieve(matchedVectorStore.id);
    }

    // Otherwise, create a new vector store with the specified name
    return await openai.beta.vectorStores.create({ name: vectorStoreName });
  } catch (error: any) {
    console.error(`Error instantiating vector store: ${error.message}`);
  }
}
