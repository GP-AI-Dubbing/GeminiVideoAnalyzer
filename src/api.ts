/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import {
  type File as GoogleFile,
  type FunctionDeclaration,
  GenerateContentResponse,
  GoogleGenAI,
} from '@google/genai';

const systemInstruction = `When given a video and a query, call the relevant \
function only once with the appropriate timecodes and text for the video`;

const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

async function generateContent(
  text: string,
  functionDeclarations: FunctionDeclaration[],
  file: GoogleFile,
): Promise<GenerateContentResponse> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        {text},
        {
          fileData: {
            mimeType: file.mimeType,
            fileUri: file.uri,
          },
        },
      ],
    },
    config: {
      systemInstruction,
      temperature: 0.5,
      tools: [{functionDeclarations}],
    },
  });

  return response;
}

async function uploadFile(file: File): Promise<GoogleFile> {
  const blob = new Blob([file], {type: file.type});

  console.log('Uploading...');
  const uploadedFile = await ai.files.upload({
    file: blob,
    config: {
      displayName: file.name,
    },
  });
  console.log('Uploaded.');
  console.log('Getting...');
  let getFile = await ai.files.get({
    name: uploadedFile.name,
  });
  while (getFile.state === 'PROCESSING') {
    // Add a delay before retrying
    await new Promise((resolve) => setTimeout(resolve, 5000));
    
    getFile = await ai.files.get({
      name: uploadedFile.name,
    });
    console.log(`current file status: ${getFile.state}`);
  }

  if (getFile.state === 'FAILED') {
    console.error('File processing failed:', getFile);
    throw new Error('File processing failed.');
  }
  console.log('File processing complete.');
  return getFile;
}

export {generateContent, uploadFile};
