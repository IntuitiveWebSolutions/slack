class ChannelLinkManager {
  constructor({
    slackWorkspace,
    subscription,
    repoName,
    issue,
    logger,
  }) {
    this.slackWorkspace = slackWorkspace;
    this.subscription = subscription;
    this.repoName = repoName;
    this.issue = issue;
    this.logger = logger;

    // Max channel name length is 80, so we truncate the repo name to fit 'github',
    // dash separators, and plenty of pr number digits
    const truncatedRepoName = repoName.slice(0, 65);
    this.expectedChannelName = `github-${truncatedRepoName}-${this.issue.number}`;
  }

  async createChannel(name, issue) {
    const createResponse = await this.slackWorkspace.userClient.conversations.create({
      name,
    });
    const slackChannel = createResponse.channel;
    const issueType = issue.html_url.includes('/pull/') ? 'Pull Request' : 'Issue';

    // Set the purpose and topic
    await this.slackWorkspace.userClient.conversations.setPurpose({
      channel: slackChannel.id,
      purpose: `View and discuss GitHub ${issueType} ${issue.html_url}`,
    });

    await this.slackWorkspace.userClient.conversations.setTopic({
      channel: slackChannel.id,
      topic: issue.html_url,
    });

    // Make the user leave the channel to avoid noise
    await this.slackWorkspace.userClient.conversations.leave({
      channel: slackChannel.id,
    });

    // Inform the main channel about this channel
    await this.slackWorkspace.botClient.chat.postMessage({
      channel: this.subscription.channelId,
      text: `Created a new channel for GitHub ${issueType} ${this.repoName} #${issue.number}: #${slackChannel.name}`,
      link_names: true,
    });

    this.logger(createResponse, 'Created Slack channel');

    return slackChannel;
  }

  async getOrCreateChannel(name, issue) {
    let slackChannel;
    let listResponse;
    const listKwargs = { limit: 100 };
    let nextCursor = '';

    // Check to see if a channel exists for this issue
    do {
      if (nextCursor !== '') {
        listKwargs.cursor = nextCursor;
      }
      // eslint-disable-next-line no-await-in-loop
      listResponse = await this.slackWorkspace.botClient.conversations.list(listKwargs);
      nextCursor = listResponse.response_metadata.next_cursor;

      // Run through the channels and try to find a match
      slackChannel = listResponse.channels.find(
        channel => channel.is_channel && channel.name === name,
      );
    } while (nextCursor !== '' && slackChannel === undefined);

    // Create the channel if it doesn't already exist
    if (slackChannel === undefined) {
      slackChannel = this.createChannel(name, issue);
    }

    return slackChannel;
  }

  async updateChannelState(slackChannel, archived) {
    if (archived === false && slackChannel.is_archived !== false) {
      // Unarchive the channel
      const unarchiveResponse = await this.slackWorkspace.userClient.conversations.unarchive({
        channel: slackChannel.id,
      });
      this.logger(unarchiveResponse, 'Unarchived Slack channel');
      slackChannel.is_archived = false; // eslint-disable-line no-param-reassign

      // Make the user leave the channel to avoid noise
      await this.slackWorkspace.userClient.conversations.leave({
        channel: slackChannel.id,
      });
    } else if (archived === true && slackChannel.is_archived !== true) {
      // Archive the channel
      const archiveResponse = await this.slackWorkspace.userClient.conversations.archive({
        channel: slackChannel.id,
      });
      this.logger(archiveResponse, 'Archived Slack channel');
      slackChannel.is_archived = true; // eslint-disable-line no-param-reassign
    }
  }

  async sendMessage(messageData) {
    const slackChannel = await this.getOrCreateChannel(this.expectedChannelName, this.issue);
    let messageResponse;
    const archiveChannel = this.issue.state === 'closed';

    // Match the channel state to the issue state.
    await this.updateChannelState(slackChannel, archiveChannel);

    if (archiveChannel === false) {
      messageResponse = await this.slackWorkspace.botClient.chat.postMessage({
        channel: slackChannel.id,
        ...messageData,
      });
      this.logger(messageResponse, 'Posted Slack message');
    } else {
      // Unarchive then rearchive the channel in order to post the message
      await this.updateChannelState(slackChannel, false);

      messageResponse = await this.slackWorkspace.botClient.chat.postMessage({
        channel: slackChannel.id,
        ...messageData,
      });
      this.logger(messageResponse, 'Posted Slack message');

      await this.updateChannelState(slackChannel, true);
    }

    return messageResponse;
  }
}

async function sendMessageToChannel({
  slackWorkspace,
  subscription,
  context,
  issue,
  message,
}) {
  let messageResponse;

  if (subscription.settings.channels) {
    const channelManager = new ChannelLinkManager({
      slackWorkspace,
      subscription,
      repoName: context.payload.repository.name,
      issue,
      logger: context.log,
    });
    messageResponse = await channelManager.sendMessage(message);
  } else {
    messageResponse = await slackWorkspace.botClient.chat.postMessage({
      channel: subscription.channelId,
      ...message,
    });
    context.log(messageResponse, 'Posted Slack message');
  }

  return messageResponse;
}

module.exports = {
  ChannelLinkManager,
  sendMessageToChannel,
};
