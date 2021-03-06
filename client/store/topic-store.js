// 用于处理与话题有关的数据
import { observable, action, extendObservable, computed, toJS } from 'mobx';
import { get, post } from '../util/http';
import { topicSchema, replySchema } from '../util/variable-define';

const createTopic = (topic) => {
    return Object.assign({}, topicSchema, topic);
};

const createReply = (topic) => {
    return Object.assign({}, replySchema, topic);
};
// 为了拓展更容易
class Topic {
    // 接受数据 初始化
    constructor(data) {
    // 把data对象上面所有的属性都附加到this上面
        extendObservable(this, data);
    }
  // 是否正在进行数据的请求
  @observable syncing = false;
  @observable createdReplies = [];
  @action doReply(content) {
      return new Promise((resolve, reject) => {
          post(`/topic/${this.id}/replies`, {
              needAccessToken: true,
          }, { content })
              .then((resp) => {
                  if (resp.success) {
                      this.createdReplies.push(createReply({
                          id: resp.reply_id,
                          content,
                          create_at: Date.now(),
                      }));
                      resolve();
                  } else {
                      reject(resp);
                  }
              }).catch(reject);
      });
  }
}

export default class TopicStore {
  @observable topics;
  @observable syncing;
  @observable details;
  @observable createdTopic = [];
  @observable tab;
  constructor({
      topics = [],
      syncing = false,
      details = [],
      tab = null,
  } = {}) {
      this.topics = topics.map(topic => new Topic(createTopic(topic)));
      this.syncing = syncing;
      this.details = details.map(topic => new Topic(createTopic(topic)));
      this.tab = tab;
  }
  @computed get detailMap() {
      return this.details.reduce((result, detail) => {
          result[detail.id] = detail;
          return result;
      }, {});
  }
  // 获取topic数据
  @action fetchTopics(tab) {
      return new Promise((resolve, reject) => {
          if (tab === this.tab && this.topics.length > 0) {
              resolve();
          } else {
              this.tab = tab;
              this.syncing = true;
              this.topics = [];
              get('/topics', {
                  // 告诉服务器要不要把字符串渲染成为markdown字符串
                  mdrender: false,
                  tab,
              }).then((resp) => {
                  if (resp.success) {
                      this.topics = resp.data.map((topic) => {
                          return new Topic(createTopic(topic));
                      });
                      resolve();
                  } else {
                      reject();
                  }
                  this.syncing = false;
              }).catch((err) => {
          console.log(err);//eslint-disable-line
                  reject(err);
                  this.syncing = false;
              });
          }
      });
  }
  @action getTopicDetail(id) {
      return new Promise((resolve, reject) => {
          if (this.detailMap[id]) {
              resolve(this.detailMap);
          } else {
              get(`/topic/${id}`, {
                  mdrender: false,
              }).then((resp) => {
                  if (resp.success) {
                      const topic = new Topic(createTopic(resp.data));
                      this.details.push(topic);
                      resolve(topic);
                  } else {
                      reject();
                  }
              }).catch(reject);
          }
      });
  }
  @action createTopic(title, tab, content) {
      return new Promise((resolve, reject) => {
          post('/topics', {
              needAccessToken: true,
          }, {
              title, tab, content,
          }).then((resp) => {
              if (resp.success) {
                  const topic = {
                      title,
                      tab,
                      content,
                      id: resp.topic_id,
                      create_at: Date.now(),
                  };
                  this.createdTopic.push(new Topic(topic));
                  resolve();
              } else {
                  reject();
              }
          }).catch(reject);
      });
  }
  toJson() {
      return {
          topics: toJS(this.topics),
          syncing: this.syncing,
          details: toJS(this.details),
          tab: this.tab,
      };
  }
}
