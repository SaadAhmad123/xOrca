> For a comprehensive understanding of this project, kindly visit the [Github repository](https://github.com/SaadAhmad123/xOrca). You can also delve into the specifics by accessing the [project's documentation](https://saadahmad123.github.io/xOrca/), where you'll find detailed Typedocs. 

> Note: This is called **xOrca** which is a derived from word **xOrchestrator** because this library build on top of [xstate@5.\*](https://stately.ai/docs/quick-start)

# xOrca
#### A library/ framework to orchestrate event-driven systems in a serverless environment

The aim of this library is to equip users with the necessary tools for creating and managing command-driven, event-oriented systems in a serverless, ephemeral environment. It's designed to avoid the rigidity of being tied to a specific Cloud Provider, thus encouraging flexibility and independence.

The `xOrca` library is a sophisticated and scalable tool for managing state in distributed and serverless applications. Leveraging [unified-serverless-storage](https://www.npmjs.com/package/unified-serverless-storage?activeTab=readme) for versatile storage solutions and [xstate (v5)](https://stately.ai/docs/quick-start) for state management, this library stands as a cornerstone for robust stateful application development.

### Installation

Install using npm:

```bash
npm install xorca unified-serverless-storage cloudevents
```

Or via yarn:

```bash
yarn add xorca unified-serverless-storage cloudevents
```

If you are using **AWS** as backend you will need to install `aws-sdk` via

```bash
yarn add aws-sdk
```

## Alternatives

Existing tools such as AWS Step Functions and Azure Durable Functions can effectively handle this type of work. These resources are widely recognized for their reliability and the ample support they receive from their respective Cloud Providers. In particular, they offer seamless serverless orchestrations through interfaces like AWS Lambda (as seen in AWS Step Functions, AWS Glue, etc.) and Azure Functions (in case of Azure Durable Functions). If vendor-specific lock-in isn't a significant concern for you, these resources are often the recommended choice. However, if you seek a less restrictive alternative, this library provides an appealing solution. It offers a fresh apporach that holds the flexibility to adapt across various providers, thus offering a certain degree of independence and ease of use.

While universal tools like Airflow DAGs are available and incredibly adequate for large scale data pipelines, namely ETL applications, they aren't designed with short-lived serverless systems in mind. These tools typically require dedicated compute clusters that persist for the entire duration of the orchestration. In situations requiring large data ETL orchestrations, AWS Glue or Airflow might be your go-to solutions.

### What this library provides?

This library takes a different approach. It has been specifically crafted for short-lived serverless systems like AWS Lambda and Azure Functions. It eliminates the need for continuous dedicated compute clusters, thus making orchestrations lighter to run and simpler to manage. Unlike Airflow DAG or AWS Glue, which excel in large data ETL tasks, this library shines when dealing with lean, scalable orchestrations.

### Example Scenario:

Take, for instance, the process of orchestrating a literature summary tool like LLM. The orchestrator receives the book's ID and decides when to issue commands to the related microservice. This triggers a sequence of actions: fetching the book's content, generating a summary, and then applying checks to the summary. Remember, the time taken to generate the summary can vary.

Once the command event has been issued, the orchestrator process is designed to pause, resuming only when a new or response event is received. This ensures that the process picks up right where it left off.

# Concepts

This library understand that some level of coupling between microservices is unavoidable. Its proposition is to manage this coupling gracefully. 

![Dependency direction](/readme/images/dir_dep.png)
[Source](https://youtu.be/zt9DFMkjkEA?t=1634)

Thus, it emphasize a balanced approach between choreography and orchestration. To ensure this balance, it is design propose a set of system rules in mind, which will be further elaborated:

- Each microservice operates independently, executing its own unique business logic.
- Each microservice adheres to the standard that both input and output events conform to the CloutEvent JSON format as defined [here](https://cloudevents.io)
- Each microservice adheres to the protocol of accepting a `cmd.*` type (such as "cmd.books.fetch") in the CloudEvent as its input. It then responds with a `evt.*` type (e.g `evt.books.fetch.success`) for actionable outputs within the orchestration context. Non-actionable outputs can be communicated via the `notif.*` type in CloudEvent. All `cmd.*`, `evt.*` and `notif.*` events can be consumed by downstream services that do not publish events in the **orchestration channel**.
- Each microservice, when responding, is required to maintain continuity by preserving the original CloudEvent subject field. This means that the subject field value in the response should match the one from the input, ensuring traceability and consistency across the entire process.
- Microservices, excluding the orchestrator, are grouped into units refered to as a `Fleet`.
- Orchestrators are standalone, ephemeral cloud functions (e.g AWS Lambda, Azure Function) with connected storage and locking backends. They subscribe to all the CloudEvents `type="evt.*"` in the **orchestration channel**. They input `evt.*` CloudEvents and output `cmd.*` and/or `notif.*` event types.
- All Fleets and Orchestrators are interconnected via an **orchestration channel**, which could be a PubSub system like AWS SNS or AWS EventBridge.

A conceptual diagram is provided below:

![Concept](/readme/images/concept.png)

A typical orchestration command CloudEvent may look as follows:
```json
{
  "source": "/orch/book/summary",
  "datacontenttype": "application/cloudevents+json; charset=UTF-8",
  "data": {
    "bookId": "some-book.pdf",
  },
  "subject": "Some subject string which must remain consistent throughout and orchestration. This is the orchestration reference",
  "type": "cmd.books.fetch",
}
```
A corresponding response CloudEvent from the microservice could look like:
```json
{
  "source": "/srvc/book/fetch",
  "datacontenttype": "application/cloudevents+json; charset=UTF-8",
  "data": {
    "bookId": "some-book.pdf",
    "bookContent": ["pages", "of", "book"]
  },
  "subject": "Some subject string which must remain consistent throughout and orchestration. This is the orchestration reference",
  "type": "evt.books.fetch.success",
}
```

It is believed that these specified guidelines will enable to manage existing coupling more effectively and provide better traceability. By maintaining this approach, it becomes easier to discern dependencies between orchestrators and microservices. When a microservice is updated, it becomes readily apparent which orchestrators will be affected, thus facilitating their subsequent updates.

This system promotes flexibility for growth and iteration. Orchestrators can be added without the need to worry about existing orchestrators. Similarly, new microservices can be introduced to a Fleet without concern for disrupting the current structure. Observers (consumers of type="notif.*") can be added seamlessly, with no negative repercussions on the existing services. Furthermore, orchestrators can be initiated either by a microservice within the Fleet or through an external service, thereby offering an extended area of applicability and utilization. 

Additionally, incorporating version control can further enhance the management and scalability of your orchestrations. This allows individual orchestrators to be updated or modified without affecting or disrupting older, live orchestrations within the system. This ensures a smoother transition during upgrades and promotes backward compatibility.

# Core Dependencies

Given that this library functions as a core orchestrator, it is imperative for it to incorporate a robust rules engine and a state management system. In this context, it views a state machine as a pivotal component of the rules engine. To construct and execute this state machine, the library leverages **xstate@5.\***, a highly acclaimed open-source state machine definition and execution tool in TypeScript developed by [stately.ai](https://stately.ai). Recognized for its popularity and effectiveness, xstate ensures a reliable foundation for orchestrating complex workflows.

Complementing this, the library relies on a standardized storage mechanism facilitated by the [unified-serverless-storage](https://www.npmjs.com/package/unified-serverless-storage?activeTab=readme) package. This integral dependency empowers the library to seamlessly manage state storage across various cloud platforms. The synergy between xstate and unified-serverless-storage enhances the library's capabilities, ensuring efficient rule execution and streamlined state management in cloud environments.

## Library Components

Within the library, various components are meticulously crafted to facilitate seamless orchestrations:

- **`orchestrateCloudEvents`** [[See details](/readme/orchestrateCloudEvents.md)] This function serves as a cornerstone, enabling the swift incorporation of orchestration into code. By adeptly managing the intricacies of state creation, persistence, and rules engine execution, it offers a straightforward solution for orchestrating complex workflows.

- **`createOrchestrationMachine`** [[See details](/readme/orchestrateCloudEvents.md)] This class empowers users to construct a state machine with a subset of features from Xstate, excluding `invoke` and `delay`. It seamlessly integrates essential features tailored for orchestrations, providing a versatile tool for crafting intricate workflows.

- **`PersistableActor`** [[See details](/readme/orchestrateCloudEvents.md)] Designed to enhance any xState Actor, this class introduces persistence to cloud storage, fortified with robust locking mechanisms. It extends the capabilities of xState Actors, ensuring resilient and secure storage of state information.

- **`CloudOrchestrationActor`** [[See details](/readme/orchestrateCloudEvents.md)] A subclass of xState Actor, this component goes beyond the standard features, incorporating properties, methods, and mechanisms essential for efficient execution of state machines within the dynamic context of short-lived serverless environments. Its design caters specifically to the unique demands of orchestrating workflows in such dynamic and resource-constrained settings.

For other functionalities see the [Typedocs](https://saadahmad123.github.io/xOrca/).