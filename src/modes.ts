/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
/* tslint:disable */
// Copyright 2024 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

interface Mode {
  emoji: string;
  prompt: string | ((input: string) => string);
  isList?: boolean;
  subModes?: {
    [key: string]: string;
  };
}

const modes: { [key: string]: Mode } = {
  'A/V captions': {
    emoji: '👀',
    prompt: `For each scene in this video, generate captions that describe the \
    scene along with any spoken text placed in quotation marks. Place each \
    caption into an object sent to set_timecodes with the timecode of the caption \
    in the video.`,
    isList: true,
  },

  Paragraph: {
    emoji: '📝',
    prompt: `Generate a paragraph that summarizes this video. Keep it to 3 to 5 \
sentences. Place each sentence of the summary into an object sent to \
set_timecodes with the timecode of the sentence in the video.`,
  },

  'Key moments': {
    emoji: '🔑',
    prompt: `Generate bullet points for the video. Place each bullet point into an \
object sent to set_timecodes with the timecode of the bullet point in the video.`,
    isList: true,
  },

  'Phân tích giọng nói': {
    emoji: '🎙️',
    prompt: `Phân tích video và xác định tất cả những người nói riêng biệt. Đối với mỗi đoạn hội thoại, hãy cung cấp timecode, xác định người nói (ví dụ: "Người nói 1", "Người nói 2") và phiên âm những gì họ nói. Gọi hàm set_speaker_diarization với kết quả.`,
    isList: true,
  },

  Table: {
    emoji: '🤓',
    prompt: `Choose 5 key shots from this video and call set_timecodes_with_objects \
with the timecode, text description of 10 words or less, and a list of objects \
visible in the scene (with representative emojis).`,
  },

  Haiku: {
    emoji: '🌸',
    prompt: `Generate a haiku for the video. Place each line of the haiku into an \
object sent to set_timecodes with the timecode of the line in the video. Make sure \
to follow the syllable count rules (5-7-5).`,
  },

  Chart: {
    emoji: '📈',
    prompt: (input) =>
      `Generate chart data for this video based on the following instructions: \
${input}. Call set_timecodes_with_numeric_values once with the list of data values and timecodes.`,
    subModes: {
      Excitement: 'for each scene, estimate the level of excitement on a scale of 1 to 10',
      Importance: 'for each scene, estimate the level of overall importance to the video on a scale of 1 to 10',
      'Number of people': 'for each scene, count the number of people visible',
    },
  },

  Custom: {
    emoji: '🔧',
    prompt: (input) => `Call set_timecodes once using the following instructions: ${input}`,
    isList: true,
  },
};

export default modes;
