import {parseSubtitles} from './core.js';

export const BUNDLED_VIDEO_ID = 'bundled-happyness-v1';

/** 创建随项目附带的视频资料，只保存本地路径，不复制大视频到每个浏览器。 */
export function createBundledVideo(cues) {
  return {
    id: BUNDLED_VIDEO_ID,
    title: '当幸福来敲门：篮球与梦想',
    bundled: true,
    mediaUrl: 'assets/default-happyness.mp4',
    mediaType: 'video/mp4',
    cues,
    mastered: [],
    saved: [],
    answers: {},
    position: 0,
  };
}

/** 优先恢复用户资料；首次打开及旧默认示例升级时选择当前随附视频。 */
export function selectStartupLesson(lessons, previousId) {
  const previous = lessons.find(lesson => lesson.id === previousId);
  if (previous && !['demo', 'bundled-reference-taylor-v1'].includes(previous.id)) return previous;
  return lessons.find(lesson => lesson.id === BUNDLED_VIDEO_ID) || previous || lessons[0];
}

/** 可选示例素材缺失时返回空值，让开源版本仍能启动并导入自己的资料。 */
export async function fetchBundledVideo(fetcher) {
  const subtitle = await fetcher('assets/default-happyness.srt');
  if (subtitle.status === 404) return null;
  if (!subtitle.ok) throw new Error('示例字幕载入失败');
  const media = await fetcher('assets/default-happyness.mp4', {method: 'HEAD'});
  if (media.status === 404) return null;
  if (!media.ok) throw new Error('示例视频载入失败');
  return createBundledVideo(parseSubtitles(await subtitle.text()));
}
