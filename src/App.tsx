import { type File as GoogleFile } from "@google/genai";
import c from "classnames";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ListVideo } from "lucide-react";
import { generateContent, uploadFile } from "./api";
import Chart from "./components/Chart.tsx";
import VideoPlayer from "./components/VideoPlayer.tsx";
import functionDeclarations from "./functions";
import modes from "./modes";
import { timeToSecs } from "./utils";
import "./App.css";
import { VideoLibrary } from "./components/VideoLibrary.tsx";
import { useVideoLibrary } from "./hooks/useVideoLibrary.ts";
import IndexedDBStorageService, {
  type StoredVideo,
} from "./services/indexedDbStorage.service.ts";
import { Typography } from "./components/ui/typography.tsx";

const chartModes = Object.keys(modes.Chart.subModes!);
type ModeKey = keyof typeof modes;

function App() {
  const {
    storedVideos,
    showLibrary,
    setShowLibrary,
    saveCurrentVideo,
    deleteVideo,
    saveAnalysisResult,
    isLoading: libraryLoading,
    error: libraryError,
  } = useVideoLibrary();

  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [vidUrl, setVidUrl] = useState<string | null>(null);
  const [file, setFile] = useState<GoogleFile | null>(null);
  const [timecodeList, setTimecodeList] = useState<any[] | null>(null);
  const [requestedTimecode, setRequestedTimecode] = useState<number | null>(
    null
  );
  const [selectedMode, setSelectedMode] = useState<ModeKey>(
    Object.keys(modes)[0] as ModeKey
  );
  const [activeMode, setActiveMode] = useState<ModeKey>();
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [chartMode, setChartMode] = useState(chartModes[0]);
  const [chartPrompt, setChartPrompt] = useState("");
  const [chartLabel, setChartLabel] = useState("");
  const [theme] = useState(
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );
  const scrollRef = useRef<HTMLElement>(null);
  const isCustomMode = selectedMode === "Custom";
  const isChartMode = selectedMode === "Chart";
  const isCustomChartMode = isChartMode && chartMode === "Custom";
  const hasSubMode = isCustomMode || isChartMode;

  const setTimecodes = ({ timecodes }: { timecodes: any[] }) =>
    setTimecodeList(
      timecodes.map((t) => ({ ...t, text: t.text?.replaceAll("\\'", "'") }))
    );

  const callbacks: { [key: string]: (args: any) => void } = {
    set_timecodes: setTimecodes,
    set_timecodes_with_objects: setTimecodes,
    set_speaker_diarization: setTimecodes,
    set_timecodes_with_numeric_values: ({ timecodes }: { timecodes: any[] }) =>
      setTimecodeList(timecodes),
  };

  const onModeSelect = async (mode: ModeKey) => {
    setActiveMode(mode);
    setIsLoading(true);
    setChartLabel(chartPrompt);

    const promptDetails = modes[mode].prompt;
    const promptText =
      typeof promptDetails === "function"
        ? promptDetails(
            isChartMode
              ? isCustomChartMode
                ? chartPrompt
                : modes.Chart.subModes![chartMode]
              : customPrompt
          )
        : promptDetails;

    try {
      const resp = await generateContent(
        promptText,
        functionDeclarations,
        file!
      );

      const call = resp.candidates?.[0]?.content?.parts?.find(
        (p) => p.functionCall
      )?.functionCall;

      if (call && call.name && callbacks[call.name]) {
        callbacks[call.name](call.args);
      }

      setIsLoading(false);
      scrollRef.current?.scrollTo({ top: 0 });

      console.log("call:", { call });
      console.log("Analysis complete:", { currentVideoId, timecodeList });

      if (currentVideoId && call?.args?.timecodes) {
        saveAnalysisResult(currentVideoId, mode + "", {
          prompt: promptText,
          timecodes: call.args.timecodes,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error generating content:", error);

      IndexedDBStorageService.deleteVideo(currentVideoId!);

      setIsLoading(false);
      // Save error result
      if (currentVideoId) {
        const errorResult = {
          mode,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Analysis failed",
          success: false,
        };
        saveAnalysisResult(currentVideoId, mode + "", errorResult);
      }
    }
  };

  const uploadVideo = async (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsLoadingVideo(true);

    const uploadedFile = e.dataTransfer.files[0];
    const urlObject = URL.createObjectURL(uploadedFile);
    setVidUrl(urlObject);

    try {
      const geminiFile = await uploadFile(uploadedFile);
      setFile(geminiFile);

      // Check file size and auto-save
      const fileSizeMB = uploadedFile.size / (1024 * 1024);
      console.log(`📹 File size: ${fileSizeMB.toFixed(2)}MB - Auto saving...`);

      // Always try to save, regardless of size
      try {
        const videoId = await saveCurrentVideo(
          uploadedFile,
          geminiFile,
          urlObject,
          videoRef.current || undefined
        );
        setCurrentVideoId(videoId);
        console.log("✅ Video saved to library successfully");
      } catch (saveError) {
        console.warn("⚠️ Failed to save to library:", saveError);

        // Show user-friendly message for storage errors
        if (saveError instanceof Error) {
          if (saveError.message.includes("quá lớn")) {
            console.log(
              `� Video too large for storage (${fileSizeMB.toFixed(
                1
              )}MB) - continuing with analysis only`
            );
          } else {
            console.log(
              `💾 Storage error: ${saveError.message} - continuing with analysis only`
            );
          }
        }
        // Continue anyway - video is still uploaded for analysis
        setCurrentVideoId(null);
      }

      setIsLoadingVideo(false);
    } catch (error) {
      console.error("Upload failed:", error);
      setVideoError(true);
      setIsLoadingVideo(false);
    }
  };

  /**
   * Handle video selection from the library
   * @param video The selected video
   */
  const handleSelectVideo = async (video: StoredVideo) => {
    try {
      setIsLoadingVideo(true);

      // Cleanup old URL
      if (vidUrl) {
        URL.revokeObjectURL(vidUrl);
      }

      // Create new URL from stored video data
      const newUrl = await IndexedDBStorageService.createVideoURL(video);

      setVidUrl(newUrl);
      setFile(video.file);
      setCurrentVideoId(video.id);

      // Reset analysis state
      setTimecodeList(null);
      setActiveMode(undefined);
      setRequestedTimecode(null);
      setVideoError(false);

      setShowLibrary(false);

      console.log("✅ Video loaded successfully:", video.name);
    } catch (error) {
      console.error("❌ Error loading video:", error);
      setVideoError(true);
    } finally {
      setIsLoadingVideo(false);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (videoId === currentVideoId) {
      // Clear current video if deleting active one
      if (vidUrl) {
        URL.revokeObjectURL(vidUrl);
      }
      setVidUrl(null);
      setFile(null);
      setCurrentVideoId(null);
      setTimecodeList(null);
      setActiveMode(undefined);
    }
    await deleteVideo(videoId);
  };

  return (
    <main
      className={theme}
      onDrop={uploadVideo}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={() => {}}
      onDragLeave={() => {}}
    >
      <div className="app-header">
        <Typography as="h3">Video Analyzer</Typography>
        <button
          className="library-button"
          onClick={() => setShowLibrary(true)}
          title="Mở thư viện video"
        >
          <span className="icon">
            <ListVideo />
          </span>
          Library ({storedVideos.length})
        </button>
      </div>

      <section className="top">
        {vidUrl && !isLoadingVideo && (
          <>
            <div className={c("modeSelector", { hide: !showSidebar })}>
              {hasSubMode ? (
                <>
                  <div>
                    {isCustomMode ? (
                      <>
                        <h2>Custom prompt:</h2>
                        <textarea
                          placeholder="Type a custom prompt..."
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              onModeSelect(selectedMode);
                            }
                          }}
                          rows={5}
                        />
                      </>
                    ) : (
                      <>
                        <h2>Chart this video by:</h2>

                        <div className="modeList">
                          {chartModes.map((mode) => (
                            <button
                              key={mode}
                              className={c("button", {
                                active: mode === chartMode,
                              })}
                              onClick={() => setChartMode(mode)}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                        <textarea
                          className={c({ active: isCustomChartMode })}
                          placeholder="Or type a custom prompt..."
                          value={chartPrompt}
                          onChange={(e) => setChartPrompt(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              onModeSelect(selectedMode);
                            }
                          }}
                          onFocus={() => setChartMode("Custom")}
                          rows={2}
                        />
                      </>
                    )}
                    <button
                      className="button generateButton"
                      onClick={() => onModeSelect(selectedMode)}
                      disabled={
                        (isCustomMode && !customPrompt.trim()) ||
                        (isChartMode &&
                          isCustomChartMode &&
                          !chartPrompt.trim())
                      }
                    >
                      ▶️ Generate
                    </button>
                  </div>
                  <div className="backButton">
                    <button
                      onClick={() =>
                        setSelectedMode(Object.keys(modes)[0] as ModeKey)
                      }
                    >
                      <span className="icon">
                        <ChevronLeft />
                      </span>
                      Back
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h2>Explore this video via:</h2>
                    <div className="modeList">
                      {Object.entries(modes).map(([mode, { emoji }]) => (
                        <button
                          key={mode}
                          className={c("button", {
                            active: mode === selectedMode,
                          })}
                          onClick={() => setSelectedMode(mode as ModeKey)}
                        >
                          <span className="emoji">{emoji}</span> {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <button
                      className="button generateButton"
                      onClick={() => onModeSelect(selectedMode)}
                    >
                      ▶️ Generate
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              className="collapseButton"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              <span className="icon">
                {showSidebar ? <ChevronLeft /> : <ChevronRight />}
              </span>
            </button>
          </>
        )}

        <VideoPlayer
          url={vidUrl}
          requestedTimecode={requestedTimecode}
          timecodeList={timecodeList}
          jumpToTimecode={setRequestedTimecode}
          isLoadingVideo={isLoadingVideo}
          videoError={videoError}
        />
      </section>

      <VideoLibrary
        videos={storedVideos}
        onSelectVideo={handleSelectVideo}
        onDeleteVideo={handleDeleteVideo}
        isVisible={showLibrary}
        onClose={() => setShowLibrary(false)}
        isLoading={libraryLoading}
        error={libraryError}
      />

      <div className={c("tools", { inactive: !vidUrl })}>
        <section
          className={c("output", { ["mode" + activeMode]: activeMode })}
          ref={scrollRef}
        >
          {isLoading ? (
            <div className="loading">
              Waiting for model<span>...</span>
            </div>
          ) : timecodeList ? (
            activeMode === "Table" ? (
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Description</th>
                    <th>Objects</th>
                  </tr>
                </thead>
                <tbody>
                  {timecodeList.map(({ time, text, objects }, i) => (
                    <tr
                      key={i}
                      role="button"
                      onClick={() => setRequestedTimecode(timeToSecs(time))}
                    >
                      <td>
                        <time>{time}</time>
                      </td>
                      <td>{text}</td>
                      <td>{objects.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeMode === "Chart" ? (
              <Chart
                data={timecodeList}
                yLabel={chartLabel}
                jumpToTimecode={setRequestedTimecode}
              />
            ) : activeMode && modes[activeMode].isList ? (
              <ul>
                {timecodeList.map(({ time, text, speaker }, i) => (
                  <li key={i} className="outputItem">
                    <button
                      onClick={() => setRequestedTimecode(timeToSecs(time))}
                    >
                      <time>{time}</time>
                      <p className="text">
                        {speaker && (
                          <span className="speakerLabel">{speaker}: </span>
                        )}
                        {text}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              timecodeList.map(({ time, text }, i) => (
                <span
                  key={i}
                  className="sentence"
                  role="button"
                  onClick={() => setRequestedTimecode(timeToSecs(time))}
                >
                  <time>{time}</time>
                  <span>{text}</span>
                </span>
              ))
            )
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default App;
