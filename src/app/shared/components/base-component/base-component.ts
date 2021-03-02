import { NgModule, OnDestroy} from "@angular/core";
import { Subject } from "rxjs";

@NgModule()
export abstract class BaseComponent implements OnDestroy {
    private destroySubject: Subject<unknown>;

    get destroy$(): Subject<unknown> {
        if (!this.destroySubject) {
            // Perf optimization:
            // since this is likely used as base component everywhere
            // only construct a Subject instance if actually used
            this.destroySubject = new Subject();
        }
        return this.destroySubject;
    }

    ngOnDestroy(): void {
        if (this.destroySubject) {
            this.destroySubject.next(true);
            this.destroySubject.complete();
        }
    }
}
