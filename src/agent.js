import axios from "axios";

const baseURL = "http://localhost:5300/api";

const instance = axios.create({
  baseURL,
  withCredentials: true,
});

const spatula = {
  // getNodes: () => instance.get('/nodes'),
  // getNode: (id: string) => instance.get(`/node/${id}`),
  // getNodeGraph: (id: string) => instance.get(`/node/${id}/graph`),
  // getChat: (id: string) => instance.get(`/chat/${id}`),
  // postChat: (message: string, nodeId: string) =>
  //   instance.post(`/chat`, { message, node: nodeId }),
  // getCrawler: () => instance.get('/crawler'),
};

export default spatula;
