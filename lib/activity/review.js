const cache = require('../cache');
const { Review } = require('../messages/review');
const { sendMessageToChannel } = require('../slack/channel-manager');

module.exports = async (context, subscription, slackWorkspace) => {
  if (
    context.payload.review.state.toLowerCase() === 'commented' &&
    context.payload.review.body === null
  ) {
    return;
  }

  // Fetch review to get body_html
  const review = (await context.github.pullRequests.getReview(context.issue({
    review_id: context.payload.review.id,
    headers: { accept: 'application/vnd.github.html+json' },
  }))).data;

  // Get rendered message
  const message = {
    attachments: [
      new Review({ ...context.payload, review }).toJSON(),
    ],
  };

  const cacheKey = subscription.cacheKey(`review#${context.payload.review.id}`);
  const storedMetaData = await cache.get(cacheKey);

  if (storedMetaData) {
    const { ts, channel } = storedMetaData;
    const res = await slackWorkspace.botClient.chat.update({
      ts,
      channel,
      ...message,
    });
    context.log(res, 'Updated Slack message');
  } else if (context.payload.action === 'submitted') {
    const messageResponse = await sendMessageToChannel({
      slackWorkspace,
      subscription,
      context,
      issue: context.payload.pull_request,
      message,
    });

    const messageMetaData = {
      channel: messageResponse.channel,
      ts: messageResponse.ts,
    };
    await cache.set(cacheKey, messageMetaData);
  }
};
