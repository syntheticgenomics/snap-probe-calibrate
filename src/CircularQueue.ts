class Node<E> {
    public data: E;
    public next: Node<E>

    public constructor(data: E, next?: Node<E>) {
        this.data = data;
        this.setNext(next);
    }

    setNext(next?: Node<E>) {
        this.next = next;
    }
}

/**
 * FIFO queue with a maximum size.  Adding to a full queue doesn't fail, but
 * instead removes items from the front.
 */
export class CircularQueue<E> 
implements Iterable<E>
{
    public  readonly capacity: number;

    protected length:  number = 0;
    protected first: Node<E>;
    protected last:  Node<E>;

    public constructor(capacity: number) {
        if (null == capacity) {
            throw new Error('capacity not specified');
        }

        if (Math.floor(capacity) !== capacity) {
            throw new Error('capacity not an integer');
        }

        if (capacity <= 0) {
            throw new Error('capacity must be positive');
        }

        this.capacity = capacity;
    }

    public size(): number {
        return this.length;
    }

    public clear(): void {
        this.length = 0;
        this.first = null;
        this.last  = null;
    }

    /**
     * Gets and returns the element at the front of the queue;
     * @returns The element at the front of the queue
     * @throws Error if queue is empty;
     */
    public dequeue(): E {
        const removed = this.first;
        if (null == removed) {
            throw new Error('No such element');
        }

        this.first = removed.next;
        this.length -= 1;
        return removed.data;
    }

    /**
     * Adds elements to the end of the queue, deleting from the front if necessary.
     * @param elements Elements to add to the front of the queue.
     * @returns the size of the queue;
     */
    public enqueue(...elements: E[]): number {
        for(let element of elements) {
            const added = new Node(element);
            this.first ||= added;
            this.last?.setNext(added);
            this.last = added;
            this.length += 1;

            if (this.length > this.capacity) {
                this.dequeue();
            }
        };

        return this.length;
    }

    /**
     * Iterable<E> implementation.
     * @returns Iterator over the contents of this queue.
     */
    [Symbol.iterator](): Iterator<E> {
        let current: Node<E> = this.first;
        return {
            next: (): IteratorResult<E> => {
                if (null != current) {
                    let toReturn = {
                        done: false,
                        value: current.data
                    }
                    current = current.next;
                    return toReturn;
                } else {
                    current = this.first;
                    return {
                        done: true,
                        value: null
                    };
                }
            }
        };
    }
}