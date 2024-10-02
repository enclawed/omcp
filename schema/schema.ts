/* JSON-RPC types */
export type JSONRPCMessage =
  | JSONRPCRequest
  | JSONRPCNotification
  | JSONRPCResponse
  | JSONRPCError;

export const JSONRPC_VERSION = "2.0";

/**
 * A progress token, used to associate progress notifications with the original request.
 */
export type ProgressToken = string | number;

export interface Request {
  method: string;
  params?: {
    _meta?: {
      /**
       * If specified, the caller is requesting out-of-band progress notifications for this request (as represented by notifications/progress). The value of this parameter is an opaque token that will be attached to any subsequent notifications. The receiver is not obligated to provide these notifications.
       */
      progressToken?: ProgressToken;
    };
    [key: string]: unknown;
  };
}

export interface Notification {
  method: string;
  params?: {
    /**
     * This parameter name is reserved by MCP to allow clients and servers to attach additional metadata to their notifications.
     */
    _meta?: { [key: string]: unknown };
    [key: string]: unknown;
  };
}

export interface Result {
  /**
   * This result property is reserved by the protocol to allow clients and servers to attach additional metadata to their responses.
   */
  _meta?: { [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * A uniquely identifying ID for a request in JSON-RPC.
 */
export type RequestId = string | number;

/**
 * A request that expects a response.
 */
export interface JSONRPCRequest extends Request {
  jsonrpc: typeof JSONRPC_VERSION;
  id: RequestId;
}

/**
 * A notification which does not expect a response.
 */
export interface JSONRPCNotification extends Notification {
  jsonrpc: typeof JSONRPC_VERSION;
}

/**
 * A successful (non-error) response to a request.
 */
export interface JSONRPCResponse {
  jsonrpc: typeof JSONRPC_VERSION;
  id: RequestId;
  result: Result;
}

// Standard JSON-RPC error codes
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;

/**
 * A response to a request that indicates an error occurred.
 */
export interface JSONRPCError {
  jsonrpc: typeof JSONRPC_VERSION;
  id: RequestId;
  error: {
    /**
     * The error type that occurred.
     */
    code: number;
    /**
     * A short description of the error. The message SHOULD be limited to a concise single sentence.
     */
    message: string;
    /**
     * Additional information about the error. The value of this member is defined by the sender (e.g. detailed error information, nested errors etc.).
     */
    data?: unknown;
  };
}

/* Empty result */
/**
 * A response that indicates success but carries no data.
 */
export type EmptyResult = Result;

/* Initialization */
export const PROTOCOL_VERSION = 1;
/**
 * This request is sent from the client to the server when it first connects, asking it to begin initialization.
 */
export interface InitializeRequest extends Request {
  method: "initialize";
  params: {
    /**
     * The latest version of the Model Context Protocol that the client supports. The client MAY decide to support older versions as well.
     */
    protocolVersion: typeof PROTOCOL_VERSION;
    capabilities: ClientCapabilities;
    clientInfo: Implementation;
  };
}

/**
 * After receiving an initialize request from the client, the server sends this response.
 */
export interface InitializeResult extends Result {
  /**
   * The version of the Model Context Protocol that the server wants to use. This may not match the version that the client requested. If the client cannot support this version, it MUST disconnect.
   */
  protocolVersion: typeof PROTOCOL_VERSION;
  capabilities: ServerCapabilities;
  serverInfo: Implementation;
}

/**
 * This notification is sent from the client to the server after initialization has finished.
 */
export interface InitializedNotification extends Notification {
  method: "notifications/initialized";
}

/**
 * Capabilities a client may support. Known capabilities are defined here, in this schema, but this is not a closed set: any client can define its own, additional capabilities.
 */
export interface ClientCapabilities {
  /**
   * Experimental, non-standard capabilities that the client supports.
   */
  experimental?: { [key: string]: object };
  /**
   * Present if the client supports sampling from an LLM.
   */
  sampling?: object;
}

/**
 * Capabilities that a server may support. Known capabilities are defined here, in this schema, but this is not a closed set: any server can define its own, additional capabilities.
 */
export interface ServerCapabilities {
  /**
   * Experimental, non-standard capabilities that the server supports.
   */
  experimental?: { [key: string]: object };
  /**
   * Present if the server supports sending log messages to the client.
   */
  logging?: object;
  /**
   * Present if the server offers any prompt templates.
   */
  prompts?: object;
  /**
   * Present if the server offers any resources to read.
   */
  resources?: {
    /**
     * Whether this server supports subscribing to resource updates.
     */
    subscribe?: boolean;
  };
  /**
   * Present if the server offers any tools to call.
   */
  tools?: object;
}

/**
 * Describes the name and version of an MCP implementation.
 */
export interface Implementation {
  name: string;
  version: string;
}

/* Ping */
/**
 * A ping, issued by either the server or the client, to check that the other party is still alive. The receiver must promptly respond, or else may be disconnected.
 */
export interface PingRequest extends Request {
  method: "ping";
}

/* Progress notifications */
/**
 * An out-of-band notification used to inform the receiver of a progress update for a long-running request.
 */
export interface ProgressNotification extends Notification {
  method: "notifications/progress";
  params: {
    /**
     * The progress token which was given in the initial request, used to associate this notification with the request that is proceeding.
     */
    progressToken: ProgressToken;
    /**
     * The progress thus far. This should increase every time progress is made, even if the total is unknown.
     *
     * @TJS-type number
     */
    progress: number;
    /**
     * Total number of items to process (or total progress required), if known.
     *
     * @TJS-type number
     */
    total?: number;
  };
}

/* Resources */
/**
 * Sent from the client to request a list of resources the server has.
 */
export interface ListResourcesRequest extends Request {
  method: "resources/list";
}

/**
 * The server's response to a resources/list request from the client.
 */
export interface ListResourcesResult extends Result {
  resourceTemplates?: ResourceTemplate[];
  resources?: Resource[];
}

/**
 * Sent from the client to the server, to read a specific resource URI.
 */
export interface ReadResourceRequest extends Request {
  method: "resources/read";
  params: {
    /**
     * The URI of the resource to read. The URI can use any protocol; it is up to the server how to interpret it.
     *
     * @format uri
     */
    uri: string;
  };
}

/**
 * The server's response to a resources/read request from the client.
 */
export interface ReadResourceResult extends Result {
  contents: (TextResourceContents | BlobResourceContents)[];
}

/**
 * An optional notification from the server to the client, informing it that the list of resources it can read from has changed. This may be issued by servers without any previous subscription from the client.
 */
export interface ResourceListChangedNotification extends Notification {
  method: "notifications/resources/list_changed";
}

/**
 * Sent from the client to request resources/updated notifications from the server whenever a particular resource changes.
 */
export interface SubscribeRequest extends Request {
  method: "resources/subscribe";
  params: {
    /**
     * The URI of the resource to subscribe to. The URI can use any protocol; it is up to the server how to interpret it.
     *
     * @format uri
     */
    uri: string;
  };
}

/**
 * Sent from the client to request cancellation of resources/updated notifications from the server. This should follow a previous resources/subscribe request.
 */
export interface UnsubscribeRequest extends Request {
  method: "resources/unsubscribe";
  params: {
    /**
     * The URI of the resource to unsubscribe from.
     *
     * @format uri
     */
    uri: string;
  };
}

/**
 * A notification from the server to the client, informing it that a resource has changed and may need to be read again. This should only be sent if the client previously sent a resources/subscribe request.
 */
export interface ResourceUpdatedNotification extends Notification {
  method: "notifications/resources/updated";
  params: {
    /**
     * The URI of the resource that has been updated. This might be a sub-resource of the one that the client actually subscribed to.
     *
     * @format uri
     */
    uri: string;
  };
}

/**
 * A known resource that the server is capable of reading.
 */
export interface Resource {
  /**
   * The URI of this resource.
   *
   * @format uri
   */
  uri: string;

  /**
   * A human-readable name for this resource.
   *
   * This can be used by clients to populate UI elements.
   */
  name: string;

  /**
   * A description of what this resource represents.
   *
   * This can be used by clients to improve the LLM's understanding of available resources. It can be thought of like a "hint" to the model.
   */
  description?: string;

  /**
   * The MIME type of this resource, if known.
   */
  mimeType?: string;
}

/**
 * A template description for resources available on the server.
 */
export interface ResourceTemplate {
  /**
   * A URI template (according to RFC 6570) that can be used to construct resource URIs.
   *
   * @format uri-template
   */
  uriTemplate: string;

  /**
   * A human-readable name for the type of resource this template refers to.
   *
   * This can be used by clients to populate UI elements.
   */
  name: string;

  /**
   * A description of what this template is for.
   *
   * This can be used by clients to improve the LLM's understanding of available resources. It can be thought of like a "hint" to the model.
   */
  description?: string;

  /**
   * The MIME type for all resources that match this template. This should only be included if all resources matching this template have the same type.
   */
  mimeType?: string;
}

/**
 * The contents of a specific resource or sub-resource.
 */
export interface ResourceContents {
  /**
   * The URI of this resource.
   *
   * @format uri
   */
  uri: string;
  /**
   * The MIME type of this resource, if known.
   */
  mimeType?: string;
}

export interface TextResourceContents extends ResourceContents {
  /**
   * The text of the item. This must only be set if the item can actually be represented as text (not binary data).
   */
  text: string;
}

export interface BlobResourceContents extends ResourceContents {
  /**
   * A base64-encoded string representing the binary data of the item.
   *
   * @format byte
   */
  blob: string;
}

/* Prompts */
/**
 * Sent from the client to request a list of prompts and prompt templates the server has.
 */
export interface ListPromptsRequest extends Request {
  method: "prompts/list";
}

/**
 * The server's response to a prompts/list request from the client.
 */
export interface ListPromptsResult extends Result {
  prompts: Prompt[];
}

/**
 * Used by the client to get a prompt provided by the server.
 */
export interface GetPromptRequest extends Request {
  method: "prompts/get";
  params: {
    /**
     * The name of the prompt or prompt template.
     */
    name: string;
    /**
     * Arguments to use for templating the prompt.
     */
    arguments?: { [key: string]: string };
  };
}

/**
 * The server's response to a prompts/get request from the client.
 */
export interface GetPromptResult extends Result {
  /**
   * An optional description for the prompt.
   */
  description?: string;
  messages: SamplingMessage[];
}

/**
 * A prompt or prompt template that the server offers.
 */
export interface Prompt {
  /**
   * The name of the prompt or prompt template.
   */
  name: string;
  /**
   * An optional description of what this prompt provides
   */
  description?: string;
  /**
   * A list of arguments to use for templating the prompt.
   */
  arguments?: PromptArgument[];
}

/**
 * Describes an argument that a prompt can accept.
 */
export interface PromptArgument {
  /**
   * The name of the argument.
   */
  name: string;
  /**
   * A human-readable description of the argument.
   */
  description?: string;
  /**
   * Whether this argument must be provided.
   */
  required?: boolean;
}

/* Tools */
/**
 * Sent from the client to request a list of tools the server has.
 */
export interface ListToolsRequest extends Request {
  method: "tools/list";
}

/**
 * The server's response to a tools/list request from the client.
 */
export interface ListToolsResult extends Result {
  tools: Tool[];
}

/**
 * The server's response to a tool call.
 */
export interface CallToolResult extends Result {
  toolResult: unknown;
}

/**
 * Used by the client to invoke a tool provided by the server.
 */
export interface CallToolRequest extends Request {
  method: "tools/call";
  params: {
    name: string;
    arguments?: { [key: string]: unknown };
  };
}

/**
 * An optional notification from the server to the client, informing it that the list of tools it offers has changed. This may be issued by servers without any previous subscription from the client.
 */
export interface ToolListChangedNotification extends Notification {
  method: "notifications/tools/list_changed";
}

/**
 * Definition for a tool the client can call.
 */
export interface Tool {
  /**
   * The name of the tool.
   */
  name: string;
  /**
   * A human-readable description of the tool.
   */
  description?: string;
  /**
   * A JSON Schema object defining the expected parameters for the tool.
   */
  inputSchema: {
    type: "object";
    properties?: { [key: string]: object };
  };
}

/* Logging */
/**
 * A request from the client to the server, to enable or adjust logging.
 */
export interface SetLevelRequest extends Request {
  method: "logging/setLevel";
  params: {
    /**
     * The level of logging that the client wants to receive from the server. The server should send all logs at this level and higher (i.e., more severe) to the client as notifications/logging/message.
     */
    level: LoggingLevel;
  };
}

/**
 * Notification of a log message passed from server to client. If no logging/setLevel request has been sent from the client, the server MAY decide which messages to send automatically.
 */
export interface LoggingMessageNotification extends Notification {
  method: "notifications/message";
  params: {
    /**
     * The severity of this log message.
     */
    level: LoggingLevel;
    /**
     * An optional name of the logger issuing this message.
     */
    logger?: string;
    /**
     * The data to be logged, such as a string message or an object. Any JSON serializable type is allowed here.
     */
    data: unknown;
  };
}

/**
 * The severity of a log message.
 */
export type LoggingLevel = "debug" | "info" | "warning" | "error";

/* Sampling */
/**
 * A request from the server to sample an LLM via the client. The client has full discretion over which model to select. The client should also inform the user before beginning sampling, to allow them to inspect the request (human in the loop) and decide whether to approve it.
 */
export interface CreateMessageRequest extends Request {
  method: "sampling/createMessage";
  params: {
    messages: SamplingMessage[];
    /**
     * An optional system prompt the server wants to use for sampling. The client MAY modify or omit this prompt.
     */
    systemPrompt?: string;
    /**
     * A request to include context from one or more MCP servers (including the caller), to be attached to the prompt. The client MAY ignore this request.
     */
    includeContext?: "none" | "thisServer" | "allServers";
    /**
     * @TJS-type number
     */
    temperature?: number;
    /**
     * The maximum number of tokens to sample, as requested by the server. The client MAY choose to sample fewer tokens than requested.
     */
    maxTokens: number;
    stopSequences?: string[];
    /**
     * Optional metadata to pass through to the LLM provider. The format of this metadata is provider-specific.
     */
    metadata?: object;
  };
}

/**
 * The client's response to a sampling/create_message request from the server. The client should inform the user before returning the sampled message, to allow them to inspect the response (human in the loop) and decide whether to allow the server to see it.
 */
export interface CreateMessageResult extends Result, SamplingMessage {
  /**
   * The name of the model that generated the message.
   */
  model: string;
  /**
   * The reason why sampling stopped.
   */
  stopReason: "endTurn" | "stopSequence" | "maxTokens";
}

/**
 * Describes a message issued to or received from an LLM API.
 */
export interface SamplingMessage {
  role: "user" | "assistant";
  content: TextContent | ImageContent;
}

/**
 * Text provided to or from an LLM.
 */
export interface TextContent {
  type: "text";
  /**
   * The text content of the message.
   */
  text: string;
}

/**
 * An image provided to or from an LLM.
 */
export interface ImageContent {
  type: "image";
  /**
   * The base64-encoded image data.
   *
   * @format byte
   */
  data: string;
  /**
   * The MIME type of the image. Different providers may support different image types.
   */
  mimeType: string;
}

/* Autocomplete */
/**
 * A request from the client to the server, to ask for completion options.
 */
export interface CompleteRequest extends Request {
  method: "completion/complete";
  params: {
    ref: PromptReference | ResourceReference;
    /**
     * The argument's information
     */
    argument: {
      /**
       * The name of the argument
       */
      name: string;
      /**
       * The value of the argument to use for completion matching.
       */
      value: string;
    };
  };
}

/**
 * The server's response to a completion/complete request
 */
export interface CompleteResult extends Result {
  completion: {
    /**
     * An array of completion values. Must not exceed 100 items.
     */
    values: string[];
    /**
     * The total number of completion options available. This can exceed the number of values actually sent in the response.
     */
    total?: number;
    /**
     * Indicates whether there are additional completion options beyond those provided in the current response, even if the exact total is unknown.
     */
    hasMore?: boolean;
  };
}

/**
 * A reference to a resource or resource template definition.
 */
export interface ResourceReference {
  type: "ref/resource";
  /**
   * The URI or URI template of the resource.
   *
   * @format uri-template
   */
  uri: string;
}

/**
 * Identifies a prompt.
 */
export interface PromptReference {
  type: "ref/prompt";
  /**
   * The name of the prompt or prompt template
   */
  name: string;
}

/* Client messages */
export type ClientRequest =
  | PingRequest
  | InitializeRequest
  | CompleteRequest
  | SetLevelRequest
  | GetPromptRequest
  | ListPromptsRequest
  | ListResourcesRequest
  | ReadResourceRequest
  | SubscribeRequest
  | UnsubscribeRequest
  | CallToolRequest
  | ListToolsRequest;

export type ClientNotification = ProgressNotification | InitializedNotification;
export type ClientResult = EmptyResult | CreateMessageResult;

/* Server messages */
export type ServerRequest = PingRequest | CreateMessageRequest;

export type ServerNotification =
  | ProgressNotification
  | LoggingMessageNotification
  | ResourceUpdatedNotification
  | ResourceListChangedNotification
  | ToolListChangedNotification;

export type ServerResult =
  | EmptyResult
  | InitializeResult
  | CompleteResult
  | GetPromptResult
  | ListPromptsResult
  | ListResourcesResult
  | ReadResourceResult
  | CallToolResult
  | ListToolsResult;
