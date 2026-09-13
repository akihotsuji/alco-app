import { Composition, Folder, Still } from "remotion";
import { IntroVideo } from "./IntroVideo";
import { CellarScene } from "./scenes/CellarScene";
import { EndScene } from "./scenes/EndScene";
import { HookScene } from "./scenes/HookScene";
import { NotesScene } from "./scenes/NotesScene";
import { RegisterScene } from "./scenes/RegisterScene";
import { StillCellar } from "./stills/StillCellar";
import { StillLogs } from "./stills/StillLogs";
import { StillNotes } from "./stills/StillNotes";
import { StillOverview } from "./stills/StillOverview";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="IntroVideo"
        component={IntroVideo}
        durationInFrames={902}
        fps={30}
        width={1080}
        height={1920}
      />
      <Folder name="Scenes">
        <Composition
          id="HookScene"
          component={HookScene}
          durationInFrames={100}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="RegisterScene"
          component={RegisterScene}
          durationInFrames={220}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="CellarScene"
          component={CellarScene}
          durationInFrames={250}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="NotesScene"
          component={NotesScene}
          durationInFrames={220}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="EndScene"
          component={EndScene}
          durationInFrames={160}
          fps={30}
          width={1080}
          height={1920}
        />
      </Folder>
      <Folder name="Stills">
        <Still id="StillOverview" component={StillOverview} width={1080} height={1350} />
        <Still id="StillLogs" component={StillLogs} width={1080} height={1350} />
        <Still id="StillCellar" component={StillCellar} width={1080} height={1350} />
        <Still id="StillNotes" component={StillNotes} width={1080} height={1350} />
      </Folder>
    </>
  );
};
